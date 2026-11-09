#!/usr/bin/env python3
"""Capture and inventory complete public Hunter Coursedog section payloads.

This diagnostic is intentionally isolated from the production scraper and database.
It omits Coursedog's ``returnFields`` parameter so the raw capture remains lossless.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any, Callable, Iterator


BASE_URL = "https://app.coursedog.com/api/v1"
ORIGIN = "https://hunter-undergraduate.catalog.cuny.edu"
COURSE_PAGE_SIZE = 500
MAX_RETRY_DELAY_SECONDS = 30.0
HEADERS = {
    "Accept": "application/json",
    "Origin": ORIGIN,
    "Referer": f"{ORIGIN}/",
    "User-Agent": "Mozilla/5.0 (compatible; WatchtowerSectionDiscovery/1.0)",
}
COURSE_FILTER = {
    "condition": "AND",
    "filters": [
        {
            "filters": [
                {
                    "id": "status-course",
                    "condition": "field",
                    "name": "status",
                    "inputType": "select",
                    "group": "course",
                    "type": "is",
                    "value": "Active",
                    "customField": False,
                },
                {
                    "id": "catalogPrint-course",
                    "condition": "field",
                    "name": "catalogPrint",
                    "inputType": "boolean",
                    "group": "course",
                    "type": "is",
                    "value": True,
                    "customField": False,
                },
                {
                    "id": "career-course",
                    "condition": "field",
                    "name": "career",
                    "inputType": "careerSelect",
                    "group": "course",
                    "type": "is",
                    "value": "Undergraduate",
                    "customField": False,
                },
            ],
            "id": "section-discovery",
            "condition": "and",
        }
    ],
}


class PayloadValidationError(ValueError):
    """A successful HTTP response did not satisfy the expected source contract."""


class CaptureIntegrityError(ValueError):
    """An existing JSONL capture cannot be resumed safely."""


class RateLimiter:
    def __init__(self, requests_per_second: float) -> None:
        self.interval = 1.0 / requests_per_second
        self.lock = threading.Lock()
        self.next_request = 0.0

    def wait(self) -> None:
        with self.lock:
            now = time.monotonic()
            delay = max(0.0, self.next_request - now)
            self.next_request = max(now, self.next_request) + self.interval
        if delay:
            time.sleep(delay)


def retry_after_seconds(
    value: str | None,
    *,
    now: datetime | None = None,
    fallback: float,
) -> float:
    """Parse Retry-After delta-seconds or HTTP-date and return a bounded delay."""
    delay = fallback
    if value:
        try:
            delay = float(value)
        except ValueError:
            try:
                retry_at = parsedate_to_datetime(value)
                if retry_at.tzinfo is None:
                    retry_at = retry_at.replace(tzinfo=timezone.utc)
                current = now or datetime.now(timezone.utc)
                delay = (retry_at - current).total_seconds()
            except (TypeError, ValueError, OverflowError):
                delay = fallback
    return max(0.0, min(delay, MAX_RETRY_DELAY_SECONDS))


def request_json(
    url: str,
    *,
    limiter: RateLimiter,
    body: dict[str, Any] | None = None,
    attempts: int = 5,
    validator: Callable[[Any], Any] | None = None,
) -> Any:
    """Request JSON and retry transport failures and invalid successful payloads."""
    data = None
    headers = dict(HEADERS)
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"

    for attempt in range(attempts):
        limiter.wait()
        request = urllib.request.Request(url, data=data, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                payload = json.load(response)
            return validator(payload) if validator else payload
        except urllib.error.HTTPError as error:
            retryable = error.code == 429 or 500 <= error.code < 600
            if not retryable or attempt + 1 == attempts:
                raise
            fallback = float(2**attempt)
            delay = retry_after_seconds(
                error.headers.get("Retry-After"),
                fallback=fallback,
            )
            time.sleep(delay)
        except (
            json.JSONDecodeError,
            UnicodeDecodeError,
            PayloadValidationError,
            TimeoutError,
            urllib.error.URLError,
        ):
            if attempt + 1 == attempts:
                raise
            time.sleep(min(float(2**attempt), MAX_RETRY_DELAY_SECONDS))
    raise RuntimeError("request attempts exhausted")


def _non_empty_text(value: Any, field: str) -> str:
    if not isinstance(value, (str, int)) or isinstance(value, bool):
        raise PayloadValidationError(f"{field} must be a string or integer")
    text = str(value).strip()
    if not text:
        raise PayloadValidationError(f"{field} must not be empty")
    return text


def _source_text(value: Any, field: str) -> str:
    if not isinstance(value, dict):
        raise PayloadValidationError(f"{field} must be an object with _text")
    return _non_empty_text(value.get("_text"), f"{field}._text")


def validate_current_term(payload: Any) -> str:
    if not isinstance(payload, dict) or "id" not in payload:
        raise PayloadValidationError("current-term payload must be an object with id")
    return _non_empty_text(payload["id"], "current-term id")


def current_term(limiter: RateLimiter) -> str:
    return request_json(
        f"{BASE_URL}/htr01/general/currentTerm",
        limiter=limiter,
        validator=validate_current_term,
    )


def validate_course_page(
    payload: Any,
    *,
    expected_skip: int,
    expected_limit: int,
    expected_total: int | None,
    seen_ids: set[str],
) -> tuple[list[dict[str, str]], int]:
    if not isinstance(payload, dict):
        raise PayloadValidationError("course page must be an object")
    if "error" in payload or "errors" in payload:
        raise PayloadValidationError("course page contains an error envelope")
    data = payload.get("data")
    if not isinstance(data, list):
        raise PayloadValidationError("course page data must be a list")

    skip = payload.get("skip")
    limit = payload.get("limit")
    total = payload.get("listLength")
    if not isinstance(skip, int) or isinstance(skip, bool) or skip != expected_skip:
        raise PayloadValidationError("course page skip does not match the request")
    if not isinstance(limit, int) or isinstance(limit, bool) or limit != expected_limit:
        raise PayloadValidationError("course page limit does not match the request")
    if not isinstance(total, int) or isinstance(total, bool) or total < 0:
        raise PayloadValidationError("course page listLength must be a non-negative integer")
    if expected_total is not None and total != expected_total:
        raise PayloadValidationError("course listLength changed during pagination")
    if len(data) > expected_limit or expected_skip + len(data) > total:
        raise PayloadValidationError("course page length is inconsistent with listLength")
    if expected_skip < total and not data:
        raise PayloadValidationError("course page was silently truncated")

    courses: list[dict[str, str]] = []
    page_ids: set[str] = set()
    for index, value in enumerate(data):
        if not isinstance(value, dict):
            raise PayloadValidationError(f"course page item {index} must be an object")
        course_id = _non_empty_text(value.get("courseGroupId"), "courseGroupId")
        code = _non_empty_text(value.get("code"), "course code")
        if course_id in page_ids or course_id in seen_ids:
            raise PayloadValidationError(f"duplicate courseGroupId {course_id}")
        page_ids.add(course_id)
        courses.append({"courseGroupId": course_id, "code": code})
    return courses, total


def active_courses(
    limiter: RateLimiter,
    *,
    allow_empty: bool = False,
) -> list[dict[str, str]]:
    courses: list[dict[str, str]] = []
    seen_ids: set[str] = set()
    expected_total: int | None = None
    skip = 0

    while expected_total is None or skip < expected_total:
        params = urllib.parse.urlencode(
            {
                "skip": skip,
                "limit": COURSE_PAGE_SIZE,
                "orderBy": "code",
                "ignoreEffectiveDating": "false",
                "columns": "courseGroupId,code,status",
            }
        )

        def validate(payload: Any) -> tuple[list[dict[str, str]], int]:
            return validate_course_page(
                payload,
                expected_skip=skip,
                expected_limit=COURSE_PAGE_SIZE,
                expected_total=expected_total,
                seen_ids=seen_ids,
            )

        page, total = request_json(
            f"{BASE_URL}/cm/htr01/courses/search/$filters?{params}",
            limiter=limiter,
            body=COURSE_FILTER,
            validator=validate,
        )
        if expected_total is None:
            expected_total = total
        courses.extend(page)
        seen_ids.update(course["courseGroupId"] for course in page)
        skip += len(page)

    if expected_total is None or len(courses) != expected_total:
        raise PayloadValidationError("course pagination did not return listLength records")
    if not courses and not allow_empty:
        raise PayloadValidationError(
            "active undergraduate course listing was empty; "
            "use --allow-empty-course-list only when this is expected"
        )
    return courses


def _class_association(section: dict[str, Any]) -> dict[str, Any]:
    custom_fields = section.get("customFields")
    if not isinstance(custom_fields, dict):
        raise PayloadValidationError("section customFields must be an object")
    association = custom_fields.get("_classAssociation")
    if not isinstance(association, dict):
        raise PayloadValidationError("section _classAssociation must be an object")
    return association


def normalize_class_components(section: dict[str, Any]) -> list[dict[str, Any]]:
    """Normalize the polymorphic declaration or fail closed for unsafe grouping."""
    custom_fields = section.get("customFields")
    if not isinstance(custom_fields, dict):
        raise PayloadValidationError("section customFields must be an object")
    _non_empty_text(custom_fields.get("associatedClass"), "associatedClass")
    association = _class_association(section)
    _source_text(association.get("SESSION_CODE"), "SESSION_CODE")

    components = association.get("CLASS_COMPONENT")
    if isinstance(components, dict):
        components = [components]
    if (
        not isinstance(components, list)
        or not components
        or any(not isinstance(component, dict) for component in components)
    ):
        raise PayloadValidationError(
            "CLASS_COMPONENT must be an object or a non-empty list of objects"
        )
    return components


def validate_sections_payload(
    payload: Any,
    *,
    expected_course_id: str,
    expected_term_id: str,
) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise PayloadValidationError("section payload must be an object")
    if "error" in payload or "errors" in payload:
        raise PayloadValidationError("section payload contains an error envelope")
    sections = payload.get("sections")
    if not isinstance(sections, list):
        raise PayloadValidationError("section payload sections must be a list")

    for index, section in enumerate(sections):
        if not isinstance(section, dict):
            raise PayloadValidationError(f"section {index} must be an object")
        _non_empty_text(section.get("id") or section.get("_id"), f"section {index} id")
        course_id = _non_empty_text(section.get("courseId"), f"section {index} courseId")
        if course_id != expected_course_id:
            raise PayloadValidationError(
                f"section {index} belongs to course {course_id}, not {expected_course_id}"
            )

        custom_fields = section.get("customFields")
        if not isinstance(custom_fields, dict):
            raise PayloadValidationError(f"section {index} customFields must be an object")
        _non_empty_text(
            custom_fields.get("associatedClass"),
            f"section {index} associatedClass",
        )
        association = _class_association(section)
        session_value = association.get("SESSION_CODE")
        term_value = association.get("STRM")
        if (session_value is None) != (term_value is None):
            raise PayloadValidationError(
                f"section {index} has an incomplete session/term relationship"
            )
        if session_value is not None:
            _source_text(session_value, f"section {index} SESSION_CODE")
            source_term = _source_text(term_value, f"section {index} STRM")
            if source_term != expected_term_id:
                raise PayloadValidationError(
                    f"section {index} belongs to term {source_term}, not {expected_term_id}"
                )
    return payload


def fetch_sections(
    course: dict[str, str], term_id: str, limiter: RateLimiter
) -> dict[str, Any]:
    course_id = urllib.parse.quote(course["courseGroupId"], safe="")
    term = urllib.parse.quote(term_id, safe="")
    url = f"{BASE_URL}/ca/htr01/sections/{term}/{course_id}?includeRelatedData=true"

    def validate(payload: Any) -> dict[str, Any]:
        return validate_sections_payload(
            payload,
            expected_course_id=course["courseGroupId"],
            expected_term_id=term_id,
        )

    payload = request_json(url, limiter=limiter, validator=validate)
    return {"termId": term_id, **course, "payload": payload}


def validate_capture_record(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise CaptureIntegrityError("capture record must be an object")
    try:
        term_id = _non_empty_text(value.get("termId"), "capture termId")
        course_id = _non_empty_text(value.get("courseGroupId"), "capture courseGroupId")
        _non_empty_text(value.get("code"), "capture course code")
        validate_sections_payload(
            value.get("payload"),
            expected_course_id=course_id,
            expected_term_id=term_id,
        )
    except PayloadValidationError as error:
        raise CaptureIntegrityError(str(error)) from error
    return value


def parse_capture_line(line: str, line_number: int) -> dict[str, Any]:
    try:
        value = json.loads(line)
    except json.JSONDecodeError as error:
        raise CaptureIntegrityError(
            f"invalid JSON on capture line {line_number}: {error.msg}"
        ) from error
    try:
        return validate_capture_record(value)
    except CaptureIntegrityError as error:
        raise CaptureIntegrityError(
            f"invalid capture record on line {line_number}: {error}"
        ) from error


def capture_key(record: dict[str, Any]) -> tuple[str, str]:
    return record["termId"], record["courseGroupId"]


def ensure_unique_capture_key(
    record: dict[str, Any],
    seen: set[tuple[str, str]],
    line_number: int,
) -> None:
    key = capture_key(record)
    if key in seen:
        raise CaptureIntegrityError(
            "duplicate capture key "
            f"(termId={key[0]}, courseGroupId={key[1]}) on line {line_number}"
        )
    seen.add(key)


def iter_capture_records(raw_path: Path) -> Iterator[dict[str, Any]]:
    if not raw_path.exists():
        return
    seen: set[tuple[str, str]] = set()
    with raw_path.open(encoding="utf-8") as source:
        for line_number, line in enumerate(source, start=1):
            record = parse_capture_line(line, line_number)
            ensure_unique_capture_key(record, seen, line_number)
            yield record


def prepare_capture_for_append(raw_path: Path, quarantine_path: Path) -> None:
    """Validate an existing capture and repair or quarantine its final partial line."""
    if not raw_path.exists() or raw_path.stat().st_size == 0:
        return

    data = raw_path.read_bytes()
    has_terminal_newline = data.endswith(b"\n")
    parts = data.splitlines(keepends=True)
    complete_parts = parts if has_terminal_newline else parts[:-1]
    seen: set[tuple[str, str]] = set()

    for line_number, part in enumerate(complete_parts, start=1):
        try:
            line = part.decode("utf-8")
        except UnicodeDecodeError as error:
            raise CaptureIntegrityError(
                f"invalid UTF-8 on capture line {line_number}"
            ) from error
        record = parse_capture_line(line, line_number)
        ensure_unique_capture_key(record, seen, line_number)

    if has_terminal_newline:
        return

    tail = parts[-1]
    line_number = len(parts)
    try:
        decoded_tail = tail.decode("utf-8")
        tail_record = parse_capture_line(decoded_tail, line_number)
    except (UnicodeDecodeError, CaptureIntegrityError):
        quarantine_path.parent.mkdir(parents=True, exist_ok=True)
        with quarantine_path.open("ab") as quarantine:
            quarantine.write(
                f"\n--- truncated tail from {raw_path.name} ---\n".encode("utf-8")
            )
            quarantine.write(tail)
            quarantine.flush()
            os.fsync(quarantine.fileno())
        complete_length = sum(len(part) for part in complete_parts)
        with raw_path.open("r+b") as capture:
            capture.truncate(complete_length)
            capture.flush()
            os.fsync(capture.fileno())
        print(
            f"Quarantined truncated final capture line to {quarantine_path}",
            flush=True,
        )
    else:
        ensure_unique_capture_key(tail_record, seen, line_number)
        with raw_path.open("ab") as capture:
            capture.write(b"\n")
            capture.flush()
            os.fsync(capture.fileno())


def completed_keys(raw_path: Path) -> set[tuple[str, str]]:
    return {
        capture_key(record)
        for record in iter_capture_records(raw_path)
    }


def stable_unique(values: list[str]) -> list[str]:
    """Deduplicate repeatable CLI values while preserving their first-seen order."""
    return list(dict.fromkeys(values))


def scalar_sample(value: Any) -> Any:
    if isinstance(value, str) and len(value) > 160:
        return value[:157] + "..."
    return value


def walk_fields(
    value: Any,
    path: str,
    counts: Counter[str],
    types: dict[str, Counter[str]],
    samples: dict[str, list[Any]],
) -> None:
    type_name = type(value).__name__
    counts[path] += 1
    types[path][type_name] += 1
    if value is None or isinstance(value, (str, int, float, bool)):
        sample = scalar_sample(value)
        if sample not in samples[path] and len(samples[path]) < 5:
            samples[path].append(sample)
        return
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}" if path else key
            walk_fields(child, child_path, counts, types, samples)
        return
    if isinstance(value, list):
        item_path = f"{path}[]"
        for child in value:
            walk_fields(child, item_path, counts, types, samples)


def nested_text(section: dict[str, Any], *keys: str) -> Any:
    value: Any = section
    for key in keys:
        if not isinstance(value, dict):
            return None
        value = value.get(key)
    return value


def build_inventory(raw_path: Path, output_path: Path) -> None:
    counts: Counter[str] = Counter()
    types: dict[str, Counter[str]] = defaultdict(Counter)
    samples: dict[str, list[Any]] = defaultdict(list)
    values: dict[str, Counter[str]] = defaultdict(Counter)
    section_count = 0
    response_count = 0
    courses_with_sections = 0

    tracked_values = {
        "status": ("status",),
        "sectionType": ("sectionType",),
        "registrationMode": ("registrationMode",),
        "instructionMode": ("instructionMode",),
        "partOfTerm": ("partOfTerm",),
        "associatedClass": ("customFields", "associatedClass"),
        "sessionCode": ("customFields", "_classAssociation", "SESSION_CODE", "_text"),
        "componentCode": ("customFields", "_classAssociation", "SSR_COMPONENT", "_text"),
        "primaryComponentCode": (
            "customFields",
            "_classAssociation",
            "COMPONENT_PRIMARY",
            "_text",
        ),
    }

    for record in iter_capture_records(raw_path):
        response_count += 1
        payload = record["payload"]
        walk_fields(payload, "payload", counts, types, samples)
        sections = payload["sections"]
        if sections:
            courses_with_sections += 1
        for section in sections:
            section_count += 1
            for label, keys in tracked_values.items():
                value = nested_text(section, *keys)
                values[label][json.dumps(value, sort_keys=True)] += 1

    inventory = {
        "rawCapture": str(raw_path),
        "responses": response_count,
        "coursesWithSections": courses_with_sections,
        "sections": section_count,
        "trackedValues": {
            label: dict(counter.most_common()) for label, counter in sorted(values.items())
        },
        "fields": {
            path: {
                "occurrences": counts[path],
                "types": dict(types[path]),
                "samples": samples[path],
            }
            for path in sorted(counts)
        },
    }
    output_path.write_text(
        json.dumps(inventory, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--term-id", action="append", help="Coursedog term ID; repeatable")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--requests-per-second", type=float, default=4.0)
    parser.add_argument("--max-courses", type=int, help="Diagnostic subset only")
    parser.add_argument(
        "--allow-empty-course-list",
        action="store_true",
        help="Allow a zero-record active course listing instead of failing closed",
    )
    parser.add_argument(
        "--course-prefix",
        action="append",
        default=[],
        help="Limit by course-code prefix; repeatable",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.workers < 1 or args.requests_per_second <= 0:
        raise SystemExit("workers and requests-per-second must be positive")
    if args.max_courses is not None and args.max_courses < 0:
        raise SystemExit("max-courses must be non-negative")

    args.output_dir.mkdir(parents=True, exist_ok=True)
    raw_path = args.output_dir / "raw-section-responses.jsonl"
    errors_path = args.output_dir / "errors.jsonl"
    inventory_path = args.output_dir / "field-inventory.json"
    quarantine_path = args.output_dir / "raw-section-responses.truncated-tail"
    prepare_capture_for_append(raw_path, quarantine_path)
    limiter = RateLimiter(args.requests_per_second)

    terms = stable_unique(args.term_id) if args.term_id else [current_term(limiter)]
    courses = active_courses(
        limiter,
        allow_empty=args.allow_empty_course_list,
    )
    if args.course_prefix:
        prefixes = tuple(prefix.upper() for prefix in args.course_prefix)
        courses = [course for course in courses if course["code"].upper().startswith(prefixes)]
    if args.max_courses is not None:
        courses = courses[: args.max_courses]

    completed = completed_keys(raw_path)
    work = [
        (course, term)
        for term in terms
        for course in courses
        if (term, course["courseGroupId"]) not in completed
    ]
    print(
        f"Capturing {len(work)} course/term responses across {len(terms)} term(s); "
        f"{len(completed)} already complete",
        flush=True,
    )

    processed = 0
    failures = 0
    with raw_path.open("a", encoding="utf-8") as raw_file, errors_path.open(
        "a", encoding="utf-8"
    ) as error_file, concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {
            executor.submit(fetch_sections, course, term, limiter): (course, term)
            for course, term in work
        }
        for future in concurrent.futures.as_completed(futures):
            course, term = futures[future]
            try:
                record = future.result()
                raw_file.write(json.dumps(record, separators=(",", ":")) + "\n")
                raw_file.flush()
            except Exception as error:  # Preserve failures for a resumable follow-up run.
                failures += 1
                error_file.write(
                    json.dumps(
                        {
                            "termId": term,
                            **course,
                            "errorType": type(error).__name__,
                            "error": str(error),
                        },
                        separators=(",", ":"),
                    )
                    + "\n"
                )
                error_file.flush()
            processed += 1
            if processed % 100 == 0 or processed == len(work):
                print(f"Completed {processed}/{len(work)} ({failures} failures)", flush=True)

    build_inventory(raw_path, inventory_path)
    print(f"Raw capture: {raw_path}")
    print(f"Field inventory: {inventory_path}")
    print(f"Errors: {errors_path}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
