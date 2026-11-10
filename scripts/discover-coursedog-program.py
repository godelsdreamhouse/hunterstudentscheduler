#!/usr/bin/env python3
"""Capture and summarize a public Hunter Coursedog program revision.

This research tool is intentionally isolated from the production database and
scheduler. It preserves the source payload when requested and reports observed
rule shapes without interpreting them as degree-audit logic.
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
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


class PayloadValidationError(ValueError):
    """The public source response does not match the expected lossless envelope."""


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


def summarize_revision(revision_id: str, revision: dict[str, Any]) -> dict[str, Any]:
    """Summarize source shapes while retaining identifiers needed for review."""
    requisites = revision.get("requisites")
    simple = requisites.get("requisitesSimple", []) if isinstance(requisites, dict) else []
    requirements = simple if isinstance(simple, list) else []
    nodes = list(iter_rule_nodes(requirements))
    conditions = Counter(node["condition"] for node in nodes)

    course_ids: set[str] = set()
    course_set_ids: set[str] = set()
    or_choice_groups = 0
    for node in nodes:
        for selection_type, identifier in _selection_references(node):
            if selection_type == "courses":
                course_ids.add(identifier)
            else:
                course_set_ids.add(identifier)
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
        "or_choice_group_count": or_choice_groups,
        "notes_node_count": notes_nodes,
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
        "manual_review_required": bool(notes_nodes or conditions.get("none")),
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
    catalog_id: str | None,
) -> dict[str, Any]:
    return {
        "source": "Hunter public Coursedog program API",
        "program_code": program_code,
        "catalog_id": catalog_id,
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
    parser.add_argument("--catalog-id")
    parser.add_argument("--input-json", type=Path)
    parser.add_argument("--raw-output", type=Path)
    args = parser.parse_args()
    if args.input_json is None and not args.catalog_id:
        parser.error("--catalog-id is required unless --input-json is provided")
    return args


def main() -> int:
    args = parse_args()
    if args.input_json:
        with args.input_json.open(encoding="utf-8") as source:
            payload = json.load(source)
    else:
        payload = request_json(program_url(args.program_code, args.catalog_id))

    revisions = validate_program_payload(payload, program_code=args.program_code)
    if args.raw_output:
        args.raw_output.parent.mkdir(parents=True, exist_ok=True)
        with args.raw_output.open("w", encoding="utf-8") as target:
            json.dump(payload, target, indent=2, sort_keys=True)
            target.write("\n")

    summary = build_summary(
        revisions,
        program_code=args.program_code,
        catalog_id=args.catalog_id,
    )
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
