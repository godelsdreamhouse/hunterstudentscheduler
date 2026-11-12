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
from decimal import Decimal, InvalidOperation
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
    "catalogDescription",
    "catalogFullDescription",
    "catalogQuote",
    "description",
    "notes",
    "programRequirements",
    "requirementsDescription",
}
MAX_RESPONSE_BYTES = 10 * 1024 * 1024
MAX_STRUCTURE_DEPTH = 100
MAX_STRUCTURE_NODES = 100_000
MAX_NUMERIC_OPERAND_CHARS = 64
ACADEMIC_RULE_FIELDS = {
    "condition",
    "credits",
    "freeformText",
    "grade",
    "gradeType",
    "logic",
    "name",
    "newRuleTree",
    "notes",
    "requisitesSimple",
    "restriction",
    "rules",
    "subRules",
    "subSelections",
    "text",
    "type",
    "value",
    "values",
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
                content_length = response.headers.get("Content-Length")
                if content_length is not None:
                    try:
                        declared_length = int(content_length)
                    except ValueError as error:
                        raise PayloadValidationError(
                            "response Content-Length must be an integer"
                        ) from error
                    if declared_length > MAX_RESPONSE_BYTES:
                        raise PayloadValidationError(
                            f"response exceeds {MAX_RESPONSE_BYTES} bytes"
                        )
                body = response.read(MAX_RESPONSE_BYTES + 1)
                if len(body) > MAX_RESPONSE_BYTES:
                    raise PayloadValidationError(
                        f"response exceeds {MAX_RESPONSE_BYTES} bytes"
                    )
                return json.loads(body)
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
    for item, _path in _bounded_walk(value, "requirements"):
        if isinstance(item, dict) and isinstance(item.get("condition"), str):
            yield item


def _bounded_walk(value: Any, root_path: str) -> Iterator[tuple[Any, str]]:
    """Walk arbitrary JSON iteratively with explicit depth and node limits."""
    stack: list[tuple[Any, str, int]] = [(value, root_path, 0)]
    visited = 0
    while stack:
        item, path, depth = stack.pop()
        visited += 1
        if visited > MAX_STRUCTURE_NODES:
            raise PayloadValidationError(
                f"{root_path} exceeds {MAX_STRUCTURE_NODES} JSON nodes"
            )
        if depth > MAX_STRUCTURE_DEPTH:
            raise PayloadValidationError(
                f"{path} exceeds maximum depth {MAX_STRUCTURE_DEPTH}"
            )
        yield item, path
        if isinstance(item, dict):
            for key, child in reversed(list(item.items())):
                stack.append((child, f"{path}.{key}", depth + 1))
        elif isinstance(item, list):
            for index in range(len(item) - 1, -1, -1):
                stack.append((item[index], f"{path}[{index}]", depth + 1))


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
    if not simple:
        return [], ["requisites.requisitesSimple must not be empty"]

    requirements: list[dict[str, Any]] = []
    for index, item in enumerate(simple):
        if isinstance(item, dict):
            requirements.append(item)
        else:
            diagnostics.append(
                f"requisites.requisitesSimple[{index}] must be an object"
            )
    return requirements, diagnostics


def _rule_shape_diagnostics(value: Any, path: str = "requirements") -> list[str]:
    diagnostics: list[str] = []
    try:
        walked = _bounded_walk(value, path)
        for item, item_path in walked:
            if not isinstance(item, dict):
                continue
            if item_path.count(".") == path.count(".") and item_path.startswith(
                f"{path}["
            ):
                rules = item.get("rules")
                if not isinstance(rules, list) or not rules:
                    diagnostics.append(f"{item_path}.rules must be a non-empty array")

            if "condition" in item:
                condition = item["condition"]
                if not isinstance(condition, str) or not condition:
                    diagnostics.append(
                        f"{item_path}.condition must be a non-empty string"
                    )
                    continue
                if condition in {"courses", "courseSets"}:
                    choices = item.get("values")
                    if not isinstance(choices, list) or not choices:
                        diagnostics.append(
                            f"{item_path}.values must be a non-empty array for {condition}"
                        )
                    else:
                        for index, choice in enumerate(choices):
                            choice_path = f"{item_path}.values[{index}]"
                            if not isinstance(choice, dict):
                                diagnostics.append(f"{choice_path} must be an object")
                                continue
                            identifiers = choice.get("value")
                            if not isinstance(identifiers, list) or not identifiers:
                                diagnostics.append(
                                    f"{choice_path}.value must be a non-empty array"
                                )
                            elif any(
                                not isinstance(identifier, (str, int))
                                or isinstance(identifier, bool)
                                or (isinstance(identifier, str) and not identifier.strip())
                                for identifier in identifiers
                            ):
                                diagnostics.append(
                                    f"{choice_path}.value contains a malformed identifier"
                                )
                            logic = choice.get("logic")
                            if logic not in {"and", "or"}:
                                diagnostics.append(
                                    f"{choice_path}.logic must be either 'and' or 'or'"
                                )
                elif condition in {"minimumCredits", "minimumGrade", "completedAtLeastXOf"}:
                    operand = {
                        "minimumCredits": "credits",
                        "minimumGrade": "grade",
                        "completedAtLeastXOf": "restriction",
                    }[condition]
                    operand_value = item.get(operand)
                    valid_operand = False
                    if condition == "minimumGrade":
                        valid_operand = (
                            isinstance(operand_value, str) and bool(operand_value.strip())
                        )
                    elif condition == "completedAtLeastXOf":
                        restriction_text = (
                            operand_value.strip()
                            if isinstance(operand_value, str)
                            else ""
                        )
                        valid_operand = (
                            isinstance(operand_value, int)
                            and not isinstance(operand_value, bool)
                            and operand_value > 0
                            and operand_value.bit_length() <= 213
                        ) or (
                            bool(restriction_text)
                            and len(restriction_text) <= MAX_NUMERIC_OPERAND_CHARS
                            and all("0" <= character <= "9" for character in restriction_text)
                            and any(character != "0" for character in restriction_text)
                        )
                    else:
                        try:
                            numeric_text = str(operand_value).strip()
                            numeric_operand = Decimal(numeric_text)
                            valid_operand = (
                                not isinstance(operand_value, bool)
                                and len(numeric_text) <= MAX_NUMERIC_OPERAND_CHARS
                                and numeric_operand.is_finite()
                                and numeric_operand > 0
                            )
                        except (InvalidOperation, ValueError, AttributeError):
                            valid_operand = False
                    if not valid_operand:
                        diagnostics.append(
                            f"{item_path}.{operand} must be a valid positive value for {condition}"
                        )
                    nested_rule = item.get("value")
                    if not isinstance(nested_rule, dict) or not nested_rule:
                        diagnostics.append(
                            f"{item_path}.value must be a non-empty rule object for {condition}"
                        )
                    elif not isinstance(
                        nested_rule.get("condition"), str
                    ) or not nested_rule.get("condition"):
                        diagnostics.append(
                            f"{item_path}.value.condition must be a non-empty string for {condition}"
                        )
                elif condition in {"allOf", "completedAllOf", "completedAnyOf"}:
                    nested_value = item.get("value")
                    has_children = any(
                        isinstance(item.get(key), list) and bool(item.get(key))
                        for key in ("rules", "subRules", "newRuleTree")
                    ) or (isinstance(nested_value, dict) and bool(nested_value))
                    if not has_children:
                        diagnostics.append(
                            f"{item_path} must contain child rules for {condition}"
                        )
                    elif isinstance(nested_value, dict) and nested_value and (
                        not isinstance(nested_value.get("condition"), str)
                        or not nested_value.get("condition")
                    ):
                        diagnostics.append(
                            f"{item_path}.value.condition must be a non-empty string for {condition}"
                        )
                elif condition == "freeformText" and not any(
                    isinstance(item.get(key), str) and item.get(key).strip()
                    for key in ("text", "freeformText", "value", "notes")
                ):
                    diagnostics.append(
                        f"{item_path} must contain text for freeformText"
                    )

            for key in {"rules", "subRules", "newRuleTree"} & item.keys():
                child = item[key]
                child_path = f"{item_path}.{key}"
                if not isinstance(child, list):
                    diagnostics.append(f"{child_path} must be an array")
                else:
                    for index, child_item in enumerate(child):
                        if not isinstance(child_item, dict):
                            diagnostics.append(
                                f"{child_path}[{index}] must be an object"
                            )
                        elif not isinstance(
                            child_item.get("condition"), str
                        ) or not child_item.get("condition"):
                            diagnostics.append(
                                f"{child_path}[{index}].condition must be a non-empty string"
                            )
    except PayloadValidationError as error:
        diagnostics.append(str(error))
    return diagnostics


def _nonempty_prose_fields(revision: dict[str, Any]) -> list[str]:
    fields: list[str] = []
    for field in sorted(TOP_LEVEL_PROSE_FIELDS):
        value = revision.get(field)
        if isinstance(value, str) and value.strip():
            fields.append(field)
        elif isinstance(value, (list, dict)) and value:
            fields.append(field)
    return fields


def _custom_field_analysis(revision: dict[str, Any]) -> tuple[list[str], list[str]]:
    """Identify academic prose and unsupported shapes in opaque custom fields."""
    custom_fields = revision.get("customFields")
    paths: list[str] = []
    diagnostics: list[str] = []
    if custom_fields in (None, {}, []):
        return paths, diagnostics
    if not isinstance(custom_fields, dict):
        return paths, ["customFields must be an object when present"]

    try:
        walked = _bounded_walk(custom_fields, "customFields")
        for value, path in walked:
            if isinstance(value, str):
                extractor = _VisibleTextExtractor()
                extractor.feed(value)
                if extractor.text():
                    paths.append(path)
            elif isinstance(value, dict):
                if path != "customFields" and value:
                    diagnostics.append(f"{path} uses an unsupported nested object")
            elif isinstance(value, list) and value:
                diagnostics.append(f"{path} uses an unsupported array")
    except PayloadValidationError as error:
        diagnostics.append(str(error))
    return sorted(set(paths)), sorted(set(diagnostics))


def summarize_revision(revision_id: str, revision: dict[str, Any]) -> dict[str, Any]:
    """Summarize source shapes while retaining identifiers needed for review."""
    requirements, schema_drift = _requirements_with_diagnostics(revision)
    schema_drift.extend(_rule_shape_diagnostics(requirements))
    try:
        nodes = list(iter_rule_nodes(requirements))
    except PayloadValidationError as error:
        schema_drift.append(str(error))
        nodes = []
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
    try:
        notes_nodes = sum(
            1
            for item in _walk_objects(requirements)
            if isinstance(item.get("notes"), str) and item["notes"].strip()
        )
    except PayloadValidationError as error:
        if str(error) not in schema_drift:
            schema_drift.append(str(error))
        notes_nodes = 0
    unsupported_conditions = sorted(
        condition for condition in conditions if condition not in KNOWN_CONDITIONS
    )
    top_level_prose_fields = _nonempty_prose_fields(revision)
    custom_field_prose_paths, custom_field_shape_diagnostics = (
        _custom_field_analysis(revision)
    )
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
    if custom_field_shape_diagnostics:
        review_reasons.append("unsupported custom-field shapes are present")
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
        "condition_node_count": sum(conditions.values()),
        "minimum_credit_values": sorted(
            {
                str(node["credits"])
                for node in nodes
                if node.get("condition") == "minimumCredits"
                and isinstance(node.get("credits"), (str, int, float))
                and not isinstance(node.get("credits"), bool)
            }
        ),
        "referenced_course_ids": sorted(course_ids),
        "referenced_course_set_ids": sorted(course_set_ids),
        "course_reference_occurrence_count": course_reference_occurrences,
        "unique_referenced_course_id_count": len(course_ids),
        "course_set_reference_occurrence_count": course_set_reference_occurrences,
        "unique_referenced_course_set_id_count": len(course_set_ids),
        "or_choice_group_count": or_choice_groups,
        "notes_node_count": notes_nodes,
        "top_level_prose_fields": top_level_prose_fields,
        "custom_field_prose_paths": custom_field_prose_paths,
        "custom_field_shape_diagnostics": custom_field_shape_diagnostics,
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
        "active_specialization_count": sum(
            1
            for item in specialization_rows
            if isinstance(item, dict) and item.get("status") == "Active"
        ),
        "manual_review_reasons": review_reasons,
        "manual_review_required": bool(review_reasons),
    }


def _walk_objects(value: Any) -> Iterator[dict[str, Any]]:
    for item, _path in _bounded_walk(value, "requirements"):
        if isinstance(item, dict):
            yield item


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
        "privacy": (
            "Minimized public academic evidence; rule text is retained for replay, "
            "while editor identities, email addresses, operational metadata, and "
            "opaque custom-field values are omitted."
        ),
        "limitations": [
            "Coursedog can edit a revision in place, so catalog and revision identifiers are not immutable snapshots.",
            "The SHA-256 identifies parsed canonical JSON content, not original HTTP transport bytes.",
            "No Psychology support, production schema, academic interpretation, or scheduler behavior is enabled.",
        ],
    }


def build_evidence_bundle(
    summary: dict[str, Any], revisions: dict[str, dict[str, Any]]
) -> dict[str, Any]:
    """Preserve the public academic fields needed to recompute the summary."""
    minimized_revisions: dict[str, Any] = {}
    for revision_id, revision in sorted(revisions.items()):
        specializations = revision.get("specializations")
        minimized_specializations = [
            {
                field: specialization.get(field)
                for field in ("id", "longName", "status", "effectiveStartDate")
            }
            for specialization in (
                specializations if isinstance(specializations, list) else []
            )
            if isinstance(specialization, dict)
        ]
        minimized_revisions[revision_id] = {
            field: revision.get(field)
            for field in (
                "code",
                "programGroupId",
                "catalogDisplayName",
                "career",
                "status",
                "effectiveStartDate",
                "effectiveEndDate",
                "version",
            )
        }
        minimized_revisions[revision_id]["requisites"] = (
            minimize_academic_rule_source(revision.get("requisites"))
        )
        minimized_revisions[revision_id]["specializations"] = minimized_specializations
    return {
        "artifact_schema_version": 1,
        "summary": summary,
        "minimized_source": minimized_revisions,
        "minimization": (
            "Allowlisted public academic rule and specialization fields only; "
            "editor identities, emails, operational metadata, and opaque custom-field "
            "values are omitted. Custom-field paths and shape diagnostics remain in "
            "the summary but are not replayable from this minimized source."
        ),
    }


def minimize_academic_rule_source(
    value: Any,
    *,
    _depth: int = 0,
    _visited: list[int] | None = None,
) -> Any:
    """Retain known academic fields, rejecting inputs beyond safe bounds."""
    if _visited is None:
        _visited = [0]
    _visited[0] += 1
    if _visited[0] > MAX_STRUCTURE_NODES:
        raise PayloadValidationError(
            f"academic evidence exceeds {MAX_STRUCTURE_NODES} JSON nodes"
        )
    if _depth > MAX_STRUCTURE_DEPTH:
        raise PayloadValidationError(
            f"academic evidence exceeds maximum depth {MAX_STRUCTURE_DEPTH}"
        )
    if isinstance(value, dict):
        return {
            key: minimize_academic_rule_source(
                child, _depth=_depth + 1, _visited=_visited
            )
            for key, child in value.items()
            if key in ACADEMIC_RULE_FIELDS
        }
    if isinstance(value, list):
        return [
            minimize_academic_rule_source(
                child, _depth=_depth + 1, _visited=_visited
            )
            for child in value
        ]
    return value


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
    parser.add_argument(
        "--summary-output",
        type=Path,
        help="Write the deterministic minimized summary in addition to stdout.",
    )
    parser.add_argument(
        "--evidence-output",
        type=Path,
        help="Write a minimized replayable academic-source bundle plus its summary.",
    )
    args = parser.parse_args()
    if args.input_json is not None and not args.captured_at_utc:
        parser.error("--captured-at-utc is required with --input-json")
    if args.captured_at_utc:
        try:
            validate_utc_timestamp(args.captured_at_utc)
        except ValueError as error:
            parser.error(f"--captured-at-utc: {error}")
    return args


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def validate_utc_timestamp(value: str) -> str:
    if not value.endswith("Z"):
        raise ValueError("timestamp must end with Z")
    try:
        parsed = datetime.fromisoformat(f"{value[:-1]}+00:00")
    except ValueError as error:
        raise ValueError("timestamp must be valid RFC 3339 UTC") from error
    if parsed.tzinfo != timezone.utc:
        raise ValueError("timestamp must use UTC")
    return value


def canonical_payload_bytes(payload: Any) -> bytes:
    return json.dumps(
        payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")


def read_bounded_json(path: Path) -> Any:
    with path.open("rb") as source:
        body = source.read(MAX_RESPONSE_BYTES + 1)
    if len(body) > MAX_RESPONSE_BYTES:
        raise PayloadValidationError(f"input exceeds {MAX_RESPONSE_BYTES} bytes")
    return json.loads(body)


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
        payload = read_bounded_json(args.input_json)
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
    if args.summary_output:
        write_private_json(args.summary_output, summary)
    if args.evidence_output:
        write_private_json(args.evidence_output, build_evidence_bundle(summary, revisions))
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
