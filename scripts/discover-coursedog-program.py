#!/usr/bin/env python3
"""Capture and summarize a public Hunter Coursedog program revision.

This research tool is intentionally isolated from the production database and
scheduler. It preserves the source payload when requested and reports observed
rule shapes without interpreting them as degree-audit logic.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterator


BASE_URL = "https://app.coursedog.com/api/v1/cm/htr01/programs"
ORIGIN = "https://hunter-undergraduate.catalog.cuny.edu"
HEADERS = {
    "Accept": "application/json",
    "Origin": ORIGIN,
    "Referer": f"{ORIGIN}/",
    "User-Agent": "Mozilla/5.0 (compatible; WatchtowerProgramDiscovery/1.0)",
    "X-Requested-With": "coursedog-core",
}
KNOWN_CONDITIONS = {
    "allOf",
    "completedAllOf",
    "completedAnyOf",
    "completedAtLeastXOf",
    "courseSets",
    "courses",
    "freeformText",
    "minimumCredits",
    "minimumGrade",
    "none",
}
TOP_LEVEL_PROSE_FIELDS = {
    "additionalRequirements",
    "admissionsRequirements",
    "description",
    "notes",
    "programRequirements",
    "requirementsDescription",
}


class PayloadValidationError(ValueError):
    """The public source response does not match the expected lossless envelope."""


class _VisibleTextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)

    def text(self) -> str:
        return " ".join(" ".join(self.parts).split())


def request_json(url: str, *, attempts: int = 4) -> Any:
    """Request public JSON with bounded retries for rate limits and server errors."""
    for attempt in range(attempts):
        request = urllib.request.Request(url, headers=HEADERS)
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            retryable = error.code == 429 or 500 <= error.code < 600
            if not retryable or attempt + 1 == attempts:
                raise
            retry_after = error.headers.get("Retry-After")
            try:
                delay = float(retry_after) if retry_after else float(2**attempt)
            except ValueError:
                delay = float(2**attempt)
            time.sleep(min(max(delay, 0.0), 30.0))
        except (TimeoutError, urllib.error.URLError, json.JSONDecodeError):
            if attempt + 1 == attempts:
                raise
            time.sleep(min(float(2**attempt), 30.0))
    raise RuntimeError("request attempts exhausted")


def program_url(program_code: str, catalog_id: str) -> str:
    query = urllib.parse.urlencode(
        {"programGroupIds": program_code, "catalogId": catalog_id}
    )
    return f"{BASE_URL}?{query}"


def validate_program_payload(payload: Any, *, program_code: str) -> dict[str, dict[str, Any]]:
    """Validate the revision map without dropping source fields."""
    if not isinstance(payload, dict) or not payload:
        raise PayloadValidationError("program response must be a non-empty object")

    revisions: dict[str, dict[str, Any]] = {}
    for revision_id, revision in payload.items():
        if not isinstance(revision_id, str) or not revision_id:
            raise PayloadValidationError("revision keys must be non-empty strings")
        if not isinstance(revision, dict):
            raise PayloadValidationError(f"revision {revision_id} must be an object")
        source_code = revision.get("programGroupId") or revision.get("code")
        if source_code != program_code:
            raise PayloadValidationError(
                f"revision {revision_id} belongs to {source_code!r}, not {program_code!r}"
            )
        revisions[revision_id] = revision
    return revisions


def iter_rule_nodes(value: Any) -> Iterator[dict[str, Any]]:
    """Yield every condition-bearing rule or selection node recursively."""
    if isinstance(value, dict):
        if isinstance(value.get("condition"), str):
            yield value
        for child in value.values():
            yield from iter_rule_nodes(child)
    elif isinstance(value, list):
        for child in value:
            yield from iter_rule_nodes(child)


def _selection_references(node: dict[str, Any]) -> Iterator[tuple[str, str]]:
    selection_type = node.get("condition")
    if selection_type not in {"courses", "courseSets"}:
        return
    values = node.get("values")
    if not isinstance(values, list):
        return
    for choice in values:
        if not isinstance(choice, dict):
            continue
        identifiers = choice.get("value")
        if not isinstance(identifiers, list):
            continue
        for identifier in identifiers:
            if isinstance(identifier, (str, int)) and not isinstance(identifier, bool):
                yield selection_type, str(identifier)


def _requirements_with_diagnostics(
    revision: dict[str, Any],
) -> tuple[list[dict[str, Any]], list[str]]:
    diagnostics: list[str] = []
    requisites = revision.get("requisites")
    if not isinstance(requisites, dict):
        return [], ["requisites must be an object"]
    if "requisitesSimple" not in requisites:
        return [], ["requisites.requisitesSimple is missing"]
    simple = requisites["requisitesSimple"]
    if not isinstance(simple, list):
        return [], ["requisites.requisitesSimple must be an array"]

    requirements: list[dict[str, Any]] = []
    for index, item in enumerate(simple):
        if isinstance(item, dict):
            requirements.append(item)
        else:
            diagnostics.append(
                f"requisites.requisitesSimple[{index}] must be an object"
            )
    return requirements, diagnostics


def _nonempty_prose_fields(revision: dict[str, Any]) -> list[str]:
    fields: list[str] = []
    for field in sorted(TOP_LEVEL_PROSE_FIELDS):
        value = revision.get(field)
        if isinstance(value, str) and value.strip():
            fields.append(field)
        elif isinstance(value, (list, dict)) and value:
            fields.append(field)
    return fields


def _custom_field_prose_paths(revision: dict[str, Any]) -> list[str]:
    """Identify opaque custom fields that contain substantial academic prose."""
    custom_fields = revision.get("customFields")
    if not isinstance(custom_fields, dict):
        return []
    paths: list[str] = []
    for field, value in sorted(custom_fields.items()):
        if not isinstance(field, str) or not isinstance(value, str):
            continue
        extractor = _VisibleTextExtractor()
        extractor.feed(value)
        if len(extractor.text()) >= 80:
            paths.append(f"customFields.{field}")
    return paths


def summarize_revision(revision_id: str, revision: dict[str, Any]) -> dict[str, Any]:
    """Summarize source shapes while retaining identifiers needed for review."""
    requirements, schema_drift = _requirements_with_diagnostics(revision)
    nodes = list(iter_rule_nodes(requirements))
    conditions = Counter(node["condition"] for node in nodes)

    course_ids: set[str] = set()
    course_set_ids: set[str] = set()
    course_reference_occurrences = 0
    course_set_reference_occurrences = 0
    or_choice_groups = 0
    for node in nodes:
        for selection_type, identifier in _selection_references(node):
            if selection_type == "courses":
                course_ids.add(identifier)
                course_reference_occurrences += 1
            else:
                course_set_ids.add(identifier)
                course_set_reference_occurrences += 1
        values = node.get("values")
        if isinstance(values, list):
            or_choice_groups += sum(
                1
                for choice in values
                if isinstance(choice, dict) and choice.get("logic") == "or"
            )

    specializations = revision.get("specializations")
    specialization_rows = specializations if isinstance(specializations, list) else []
    requirement_names = [
        item.get("name")
        for item in requirements
        if isinstance(item, dict) and isinstance(item.get("name"), str)
    ]
    notes_nodes = sum(
        1
        for item in _walk_objects(requirements)
        if isinstance(item.get("notes"), str) and item["notes"].strip()
    )
    unsupported_conditions = sorted(
        condition for condition in conditions if condition not in KNOWN_CONDITIONS
    )
    top_level_prose_fields = _nonempty_prose_fields(revision)
    custom_field_prose_paths = _custom_field_prose_paths(revision)
    review_reasons: list[str] = []
    if notes_nodes:
        review_reasons.append("explanatory notes are present")
    if conditions.get("none"):
        review_reasons.append("unresolved none condition is present")
    if conditions.get("freeformText"):
        review_reasons.append("freeformText condition is present")
    if unsupported_conditions:
        review_reasons.append("unsupported condition types are present")
    if top_level_prose_fields or custom_field_prose_paths:
        review_reasons.append("academic prose outside typed rule nodes is present")
    if schema_drift:
        review_reasons.append("requirement tree schema drift was detected")

    return {
        "revision_id": revision_id,
        "program_code": revision.get("code"),
        "program_group_id": revision.get("programGroupId"),
        "catalog_display_name": revision.get("catalogDisplayName"),
        "career": revision.get("career"),
        "status": revision.get("status"),
        "effective_start_date": revision.get("effectiveStartDate"),
        "effective_end_date": revision.get("effectiveEndDate"),
        "version": revision.get("version"),
        "completion_requirement_count": len(requirements),
        "completion_requirement_names": requirement_names,
        "condition_counts": dict(sorted(conditions.items())),
        "referenced_course_ids": sorted(course_ids),
        "referenced_course_set_ids": sorted(course_set_ids),
        "course_reference_occurrence_count": course_reference_occurrences,
        "course_set_reference_occurrence_count": course_set_reference_occurrences,
        "or_choice_group_count": or_choice_groups,
        "notes_node_count": notes_nodes,
        "top_level_prose_fields": top_level_prose_fields,
        "custom_field_prose_paths": custom_field_prose_paths,
        "unsupported_conditions": unsupported_conditions,
        "schema_drift_diagnostics": schema_drift,
        "specializations": [
            {
                "id": item.get("id"),
                "long_name": item.get("longName"),
                "status": item.get("status"),
                "effective_start_date": item.get("effectiveStartDate"),
            }
            for item in specialization_rows
            if isinstance(item, dict)
        ],
        "manual_review_reasons": review_reasons,
        "manual_review_required": bool(review_reasons),
    }


def _walk_objects(value: Any) -> Iterator[dict[str, Any]]:
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from _walk_objects(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk_objects(child)


def build_summary(
    revisions: dict[str, dict[str, Any]],
    *,
    program_code: str,
    catalog_id: str,
    captured_at_utc: str,
    source_url: str,
    canonical_json_sha256: str,
) -> dict[str, Any]:
    return {
        "source": "Hunter public Coursedog program API",
        "program_code": program_code,
        "catalog_id": catalog_id,
        "captured_at_utc": captured_at_utc,
        "source_url": source_url,
        "canonical_json_sha256": canonical_json_sha256,
        "revision_count": len(revisions),
        "revisions": [
            summarize_revision(revision_id, revision)
            for revision_id, revision in sorted(revisions.items())
        ],
        "interpretation_boundary": (
            "Observed source structure only; not an official audit or executable "
            "academic-rule interpretation."
        ),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--program-code", required=True)
    parser.add_argument("--catalog-id", required=True)
    parser.add_argument("--input-json", type=Path)
    parser.add_argument(
        "--captured-at-utc",
        help="Required with --input-json; UTC time when the source payload was fetched.",
    )
    parser.add_argument("--raw-output", type=Path)
    args = parser.parse_args()
    if args.input_json is not None and not args.captured_at_utc:
        parser.error("--captured-at-utc is required with --input-json")
    return args


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def canonical_payload_bytes(payload: Any) -> bytes:
    return json.dumps(
        payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")


def write_private_json(path: Path, value: Any) -> None:
    """Atomically write JSON with owner-only permissions."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as target:
            json.dump(value, target, indent=2, sort_keys=True)
            target.write("\n")
        os.replace(temporary, path)
        os.chmod(path, 0o600)
    except BaseException:
        temporary.unlink(missing_ok=True)
        raise


def main() -> int:
    args = parse_args()
    source_url = program_url(args.program_code, args.catalog_id)
    if args.input_json:
        with args.input_json.open(encoding="utf-8") as source:
            payload = json.load(source)
        captured_at_utc = args.captured_at_utc
    else:
        payload = request_json(source_url)
        captured_at_utc = utc_now()

    revisions = validate_program_payload(payload, program_code=args.program_code)
    payload_sha256 = hashlib.sha256(canonical_payload_bytes(payload)).hexdigest()
    if args.raw_output:
        print(
            "warning: raw public payload may contain editor email addresses and "
            "operational metadata; keep it private and share a minimized artifact",
            file=sys.stderr,
        )
        write_private_json(args.raw_output, payload)
        metadata_path = args.raw_output.with_name(f"{args.raw_output.name}.metadata.json")
        write_private_json(
            metadata_path,
            {
                "canonical_json_sha256": payload_sha256,
                "captured_at_utc": captured_at_utc,
                "catalog_id": args.catalog_id,
                "program_code": args.program_code,
                "source_url": source_url,
                "privacy_note": (
                    "Raw public source payload; may contain editor email addresses "
                    "and operational metadata. Keep private and share a minimized artifact."
                ),
            },
        )

    summary = build_summary(
        revisions,
        program_code=args.program_code,
        catalog_id=args.catalog_id,
        captured_at_utc=captured_at_utc,
        source_url=source_url,
        canonical_json_sha256=payload_sha256,
    )
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
