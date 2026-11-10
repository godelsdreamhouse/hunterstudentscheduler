"""Offline tests for the read-only Coursedog program source probe."""

from __future__ import annotations

import importlib.util
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
        self.assertEqual(revision["or_choice_group_count"], 1)
        self.assertEqual(revision["notes_node_count"], 1)
        self.assertTrue(revision["manual_review_required"])

    def test_builds_encoded_public_endpoint_url(self) -> None:
        url = discovery.program_url("PSYCH-BA", "catalog/id")

        self.assertIn("programGroupIds=PSYCH-BA", url)
        self.assertIn("catalogId=catalog%2Fid", url)


if __name__ == "__main__":
    unittest.main()
