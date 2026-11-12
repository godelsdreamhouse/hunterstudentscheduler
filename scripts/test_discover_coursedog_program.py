"""Offline tests for the read-only Coursedog program source probe."""

from __future__ import annotations

import importlib.util
import json
import stat
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("discover-coursedog-program.py")
SPEC = importlib.util.spec_from_file_location("coursedog_program_discovery", SCRIPT)
assert SPEC and SPEC.loader
discovery = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(discovery)


def fixture() -> dict[str, object]:
    return {
        "PSYCH-BA-2026-07-01": {
            "code": "PSYCH-BA",
            "programGroupId": "PSYCH-BA",
            "catalogDisplayName": "Psychology",
            "career": "Undergraduate",
            "status": "Active",
            "effectiveStartDate": "2026-07-01",
            "effectiveEndDate": None,
            "version": 5,
            "requisites": {
                "requisitesSimple": [
                    {
                        "name": "Synthetic major requirement",
                        "notes": "<p>Advisor review required.</p>",
                        "rules": [
                            {
                                "condition": "allOf",
                                "subRules": [
                                    {
                                        "condition": "minimumCredits",
                                        "credits": 6,
                                        "value": {
                                            "condition": "courses",
                                            "values": [
                                                {"value": ["course-2", "course-1"], "logic": "and"},
                                                {"value": ["course-4", "course-3"], "logic": "or"},
                                            ],
                                        },
                                    },
                                    {
                                        "condition": "completedAtLeastXOf",
                                        "restriction": 1,
                                        "value": {
                                            "condition": "courseSets",
                                            "values": [
                                                {"value": ["set-1"], "logic": "and"},
                                            ],
                                        },
                                    },
                                    {
                                        "condition": "minimumGrade",
                                        "grade": "B",
                                        "value": {"condition": "none", "values": []},
                                    },
                                ],
                            }
                        ],
                    }
                ]
            },
            "specializations": [
                {
                    "id": "PSYCH",
                    "longName": "Psychology",
                    "status": "Active",
                    "effectiveStartDate": "1901-01-01",
                }
            ],
        }
    }


class ProgramDiscoveryTests(unittest.TestCase):
    def test_validates_revision_identity_without_dropping_fields(self) -> None:
        payload = fixture()

        validated = discovery.validate_program_payload(payload, program_code="PSYCH-BA")

        self.assertIs(validated["PSYCH-BA-2026-07-01"], payload["PSYCH-BA-2026-07-01"])

    def test_rejects_empty_malformed_and_wrong_program_payloads(self) -> None:
        cases = [
            {},
            [],
            {"revision": []},
            {"revision": {"programGroupId": "OTHER-BA"}},
        ]
        for payload in cases:
            with self.subTest(payload=payload):
                with self.assertRaises(discovery.PayloadValidationError):
                    discovery.validate_program_payload(payload, program_code="PSYCH-BA")

    def test_summarizes_conditions_references_and_manual_review_flags(self) -> None:
        revisions = discovery.validate_program_payload(fixture(), program_code="PSYCH-BA")

        summary = discovery.build_summary(
            revisions,
            program_code="PSYCH-BA",
            catalog_id="catalog-1",
            captured_at_utc="2026-11-12T00:00:00Z",
            source_url=discovery.program_url("PSYCH-BA", "catalog-1"),
            canonical_json_sha256="0" * 64,
        )
        revision = summary["revisions"][0]

        self.assertEqual(revision["completion_requirement_count"], 1)
        self.assertEqual(
            revision["condition_counts"],
            {
                "allOf": 1,
                "completedAtLeastXOf": 1,
                "courseSets": 1,
                "courses": 1,
                "minimumCredits": 1,
                "minimumGrade": 1,
                "none": 1,
            },
        )
        self.assertEqual(
            revision["referenced_course_ids"],
            ["course-1", "course-2", "course-3", "course-4"],
        )
        self.assertEqual(revision["referenced_course_set_ids"], ["set-1"])
        self.assertEqual(revision["course_reference_occurrence_count"], 4)
        self.assertEqual(revision["course_set_reference_occurrence_count"], 1)
        self.assertEqual(revision["or_choice_group_count"], 1)
        self.assertEqual(revision["notes_node_count"], 1)
        self.assertTrue(revision["manual_review_required"])

    def test_fails_closed_for_missing_malformed_and_unsupported_rules(self) -> None:
        cases = [
            ({}, "requisites must be an object"),
            ({"requisites": {}}, "requisites.requisitesSimple is missing"),
            (
                {"requisites": {"requisitesSimple": {}}},
                "requisites.requisitesSimple must be an array",
            ),
        ]
        for replacement, diagnostic in cases:
            with self.subTest(diagnostic=diagnostic):
                revision = fixture()["PSYCH-BA-2026-07-01"]
                revision.pop("requisites", None)
                revision.update(replacement)
                summary = discovery.summarize_revision("revision", revision)
                self.assertTrue(summary["manual_review_required"])
                self.assertIn(diagnostic, summary["schema_drift_diagnostics"])

        revision = fixture()["PSYCH-BA-2026-07-01"]
        revision["description"] = "Students must complete an adviser-reviewed rule."
        revision["customFields"] = {
            "opaqueRule": "Students must earn letter grades in every course used for the major; pass/no-credit selections require academic review."
        }
        revision["requisites"]["requisitesSimple"] = [
            {
                "name": "Prose and future rule",
                "rules": [
                    {"condition": "freeformText", "text": "Review this rule."},
                    {"condition": "futureRule", "value": 1},
                ],
            }
        ]
        summary = discovery.summarize_revision("revision", revision)
        self.assertTrue(summary["manual_review_required"])
        self.assertEqual(summary["unsupported_conditions"], ["futureRule"])
        self.assertEqual(summary["top_level_prose_fields"], ["description"])
        self.assertEqual(summary["custom_field_prose_paths"], ["customFields.opaqueRule"])
        self.assertIn("freeformText condition is present", summary["manual_review_reasons"])

    def test_emits_provenance_and_writes_private_raw_artifacts(self) -> None:
        payload = fixture()
        digest = discovery.hashlib.sha256(
            discovery.canonical_payload_bytes(payload)
        ).hexdigest()
        summary = discovery.build_summary(
            discovery.validate_program_payload(payload, program_code="PSYCH-BA"),
            program_code="PSYCH-BA",
            catalog_id="catalog-1",
            captured_at_utc="2026-11-12T00:00:00Z",
            source_url=discovery.program_url("PSYCH-BA", "catalog-1"),
            canonical_json_sha256=digest,
        )
        self.assertEqual(summary["canonical_json_sha256"], digest)
        self.assertEqual(summary["captured_at_utc"], "2026-11-12T00:00:00Z")

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "raw.json"
            discovery.write_private_json(path, payload)
            self.assertEqual(json.loads(path.read_text(encoding="utf-8")), payload)
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)

    def test_builds_encoded_public_endpoint_url(self) -> None:
        url = discovery.program_url("PSYCH-BA", "catalog/id")

        self.assertIn("programGroupIds=PSYCH-BA", url)
        self.assertIn("catalogId=catalog%2Fid", url)


if __name__ == "__main__":
    unittest.main()
