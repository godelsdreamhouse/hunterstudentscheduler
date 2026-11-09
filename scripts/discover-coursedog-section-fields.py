#!/usr/bin/env python3
"""Capture and inventory complete public Hunter Coursedog section payloads.

This diagnostic is intentionally isolated from the production scraper and database.
It omits Coursedog's ``returnFields`` parameter so the raw capture remains lossless.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import json
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


BASE_URL = "https://app.coursedog.com/api/v1"
ORIGIN = "https://hunter-undergraduate.catalog.cuny.edu"
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


def request_json(
    url: str,
    *,
    limiter: RateLimiter,
    body: dict[str, Any] | None = None,
    attempts: int = 5,
) -> Any:
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
                return json.load(response)
        except urllib.error.HTTPError as error:
            retryable = error.code == 429 or 500 <= error.code < 600
            if not retryable or attempt + 1 == attempts:
                raise
            retry_after = error.headers.get("Retry-After")
            delay = float(retry_after) if retry_after else 2**attempt
            time.sleep(min(delay, 30))
        except (TimeoutError, urllib.error.URLError):
            if attempt + 1 == attempts:
                raise
            time.sleep(min(2**attempt, 30))
    raise RuntimeError("request attempts exhausted")


def current_term(limiter: RateLimiter) -> str:
    payload = request_json(
        f"{BASE_URL}/htr01/general/currentTerm", limiter=limiter
    )
    return str(payload["id"])


def active_courses(limiter: RateLimiter) -> list[dict[str, str]]:
    params = urllib.parse.urlencode(
        {
            "skip": 0,
            "limit": 99999,
            "orderBy": "code",
            "ignoreEffectiveDating": "false",
            "columns": "courseGroupId,code,status",
        }
    )
    payload = request_json(
        f"{BASE_URL}/cm/htr01/courses/search/$filters?{params}",
        limiter=limiter,
        body=COURSE_FILTER,
    )
    courses = []
    for course in payload.get("data", []):
        course_id = course.get("courseGroupId")
        if course_id:
            courses.append(
                {"courseGroupId": str(course_id), "code": str(course.get("code", ""))}
            )
    return courses


def fetch_sections(
    course: dict[str, str], term_id: str, limiter: RateLimiter
) -> dict[str, Any]:
    course_id = urllib.parse.quote(course["courseGroupId"], safe="")
    term = urllib.parse.quote(term_id, safe="")
    # Deliberately no returnFields: retain every public field and related record.
    url = f"{BASE_URL}/ca/htr01/sections/{term}/{course_id}?includeRelatedData=true"
    return {
        "termId": term_id,
        **course,
        "payload": request_json(url, limiter=limiter),
    }


def completed_keys(raw_path: Path) -> set[tuple[str, str]]:
    completed: set[tuple[str, str]] = set()
    if not raw_path.exists():
        return completed
    with raw_path.open(encoding="utf-8") as source:
        for line in source:
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            completed.add((str(record.get("termId", "")), str(record.get("courseGroupId", ""))))
    return completed


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
        "sessionCode": (
            "customFields",
            "_classAssociation",
            "SESSION_CODE",
            "_text",
        ),
        "componentCode": (
            "customFields",
            "_classAssociation",
            "SSR_COMPONENT",
            "_text",
        ),
        "primaryComponentCode": (
            "customFields",
            "_classAssociation",
            "COMPONENT_PRIMARY",
            "_text",
        ),
    }

    with raw_path.open(encoding="utf-8") as source:
        for line in source:
            record = json.loads(line)
            response_count += 1
            payload = record.get("payload", {})
            walk_fields(payload, "payload", counts, types, samples)
            sections = payload.get("sections", []) if isinstance(payload, dict) else []
            if sections:
                courses_with_sections += 1
            for section in sections:
                if not isinstance(section, dict):
                    continue
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
    output_path.write_text(json.dumps(inventory, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--term-id", action="append", help="Coursedog term ID; repeatable")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--requests-per-second", type=float, default=4.0)
    parser.add_argument("--max-courses", type=int, help="Diagnostic subset only")
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
    limiter = RateLimiter(args.requests_per_second)

    terms = args.term_id or [current_term(limiter)]
    courses = active_courses(limiter)
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
