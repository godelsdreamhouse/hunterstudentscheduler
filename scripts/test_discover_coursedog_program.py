"""Offline tests for the read-only Coursedog program source probe."""

from __future__ import annotations

import importlib.util
import io
import json
import stat
import subprocess
import tempfile
import unittest
from unittest import mock
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
        revision["catalogFullDescription"] = "Additional academic program prose."
        revision["customFields"] = {
            "opaqueRule": "Students must earn letter grades in every course used for the major; pass/no-credit selections require academic review.",
            "linkOnly": '<p><a href="https://example.edu/program-code">Program code</a></p>',
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
        self.assertEqual(
            summary["top_level_prose_fields"],
            ["catalogFullDescription", "description"],
        )
        self.assertEqual(
            summary["custom_field_prose_paths"],
            ["customFields.linkOnly", "customFields.opaqueRule"],
        )
        self.assertIn("freeformText condition is present", summary["manual_review_reasons"])

    def test_fails_closed_for_malformed_nested_rules_and_custom_fields(self) -> None:
        revision = fixture()["PSYCH-BA-2026-07-01"]
        revision["requisites"]["requisitesSimple"] = [
            {
                "name": "Malformed",
                "rules": "not-a-rule-tree",
                "subRules": [42],
                "extra": [
                    {"condition": 123},
                    {"condition": "courses", "values": "course-1"},
                    {
                        "condition": "courses",
                        "values": [
                            {"value": ["course-1"]},
                            {"value": ["course-2"], "logic": 42},
                        ],
                    },
                ],
            }
        ]
        revision["customFields"] = {
            "nested": {
                "text": "Academic prose that is intentionally long enough to require a manual review because its meaning is not represented by a typed rule node."
            }
        }

        summary = discovery.summarize_revision("revision", revision)

        self.assertTrue(summary["manual_review_required"])
        self.assertIn(
            "requirements[0].rules must be an array",
            summary["schema_drift_diagnostics"],
        )
        self.assertIn(
            "requirements[0].extra[0].condition must be a non-empty string",
            summary["schema_drift_diagnostics"],
        )
        self.assertIn(
            "requirements[0].extra[1].values must be a non-empty array for courses",
            summary["schema_drift_diagnostics"],
        )
        self.assertIn(
            "requirements[0].subRules[0] must be an object",
            summary["schema_drift_diagnostics"],
        )
        self.assertIn(
            "requirements[0].extra[2].values[0].logic must be either 'and' or 'or'",
            summary["schema_drift_diagnostics"],
        )
        self.assertIn(
            "requirements[0].extra[2].values[1].logic must be either 'and' or 'or'",
            summary["schema_drift_diagnostics"],
        )
        self.assertEqual(
            summary["custom_field_prose_paths"], ["customFields.nested.text"]
        )
        self.assertIn(
            "customFields.nested uses an unsupported nested object",
            summary["custom_field_shape_diagnostics"],
        )

    def test_empty_and_incomplete_known_rules_fail_closed(self) -> None:
        cases = [
            [],
            [{}],
            [{"rules": [{}]}],
            [{"rules": [{"condition": "minimumCredits"}]}],
            [{"rules": [{"condition": "minimumGrade"}]}],
            [{"rules": [{"condition": "completedAtLeastXOf"}]}],
            [{"rules": [{"condition": "allOf"}]}],
            [
                {
                    "rules": [
                        {"condition": "minimumCredits", "credits": 3, "value": {}}
                    ]
                }
            ],
            [
                {
                    "rules": [
                        {
                            "condition": "completedAtLeastXOf",
                            "restriction": "1" * 5000,
                            "value": {
                                "condition": "courses",
                                "values": [
                                    {"value": ["course-1"], "logic": "and"}
                                ],
                            },
                        }
                    ]
                }
            ],
            [
                {
                    "rules": [
                        {"condition": "minimumGrade", "grade": "B", "value": {}}
                    ]
                }
            ],
            [
                {
                    "rules": [
                        {
                            "condition": "completedAtLeastXOf",
                            "restriction": 1,
                            "value": {},
                        }
                    ]
                }
            ],
            [{"rules": [{"condition": "allOf", "value": {}}]}],
            [{"rules": [{"condition": "completedAllOf", "value": {}}]}],
            [{"rules": [{"condition": "allOf", "value": {"unexpected": 1}}]}],
            [{"rules": [{"condition": "allOf", "subRules": [{}]}]}],
            [
                {
                    "rules": [
                        {
                            "condition": "minimumCredits",
                            "credits": "banana",
                            "value": {"condition": "none"},
                        }
                    ]
                }
            ],
            [
                {
                    "rules": [
                        {
                            "condition": "courses",
                            "values": [{"value": [""], "logic": "and"}],
                        }
                    ]
                }
            ],
        ]
        for rules in cases:
            with self.subTest(rules=rules):
                revision = fixture()["PSYCH-BA-2026-07-01"]
                revision["requisites"]["requisitesSimple"] = rules
                summary = discovery.summarize_revision("revision", revision)
                self.assertTrue(summary["manual_review_required"])
                self.assertTrue(summary["schema_drift_diagnostics"])

    def test_freeform_text_accepts_live_notes_shape_but_still_requires_review(self) -> None:
        revision = fixture()["PSYCH-BA-2026-07-01"]
        revision["requisites"]["requisitesSimple"] = [
            {
                "name": "Observed live shape",
                "rules": [
                    {"condition": "freeformText", "notes": "Advisor review required."}
                ],
            }
        ]

        summary = discovery.summarize_revision("revision", revision)

        self.assertTrue(summary["manual_review_required"])
        self.assertNotIn(
            "requirements[0].rules[0] must contain text for freeformText",
            summary["schema_drift_diagnostics"],
        )

    def test_short_opaque_custom_field_text_requires_review(self) -> None:
        revision = fixture()["PSYCH-BA-2026-07-01"]
        revision["customFields"] = {"shortRule": "Minimum grade B required."}

        summary = discovery.summarize_revision("revision", revision)

        self.assertTrue(summary["manual_review_required"])
        self.assertEqual(
            summary["custom_field_prose_paths"], ["customFields.shortRule"]
        )

    def test_deep_source_fails_closed_without_recursion_error(self) -> None:
        nested: dict[str, object] = {"condition": "none"}
        for _index in range(discovery.MAX_STRUCTURE_DEPTH + 5):
            nested = {"condition": "allOf", "value": nested}
        revision = fixture()["PSYCH-BA-2026-07-01"]
        revision["requisites"]["requisitesSimple"] = [
            {"name": "Deep", "rules": [nested]}
        ]

        summary = discovery.summarize_revision("revision", revision)

        self.assertTrue(summary["manual_review_required"])
        self.assertTrue(
            any("maximum depth" in item for item in summary["schema_drift_diagnostics"])
        )

    def test_offline_input_size_is_bounded(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "large.json"
            path.write_bytes(b" " * (discovery.MAX_RESPONSE_BYTES + 1))
            with self.assertRaisesRegex(
                discovery.PayloadValidationError, "input exceeds"
            ):
                discovery.read_bounded_json(path)

        oversized_stream = io.BytesIO(b" " * (discovery.MAX_RESPONSE_BYTES + 1))
        stream_path = mock.MagicMock()
        stream_path.open.return_value = oversized_stream
        with self.assertRaisesRegex(discovery.PayloadValidationError, "input exceeds"):
            discovery.read_bounded_json(stream_path)
        stream_path.open.assert_called_once_with("rb")

    def test_http_declared_response_size_is_bounded(self) -> None:
        response = mock.MagicMock()
        response.headers = {
            "Content-Length": str(discovery.MAX_RESPONSE_BYTES + 1)
        }
        response.__enter__.return_value = response
        response.__exit__.return_value = False
        with mock.patch.object(discovery.urllib.request, "urlopen", return_value=response):
            with self.assertRaisesRegex(
                discovery.PayloadValidationError, "response exceeds"
            ):
                discovery.request_json("https://example.invalid", attempts=1)

    def test_evidence_bundle_replays_academic_summary_fields(self) -> None:
        payload = fixture()
        revisions = discovery.validate_program_payload(payload, program_code="PSYCH-BA")
        summary = discovery.build_summary(
            revisions,
            program_code="PSYCH-BA",
            catalog_id="catalog-1",
            captured_at_utc="2026-11-12T00:00:00Z",
            source_url=discovery.program_url("PSYCH-BA", "catalog-1"),
            canonical_json_sha256="0" * 64,
        )

        bundle = discovery.build_evidence_bundle(summary, revisions)
        replay_revision = discovery.summarize_revision(
            "PSYCH-BA-2026-07-01",
            bundle["minimized_source"]["PSYCH-BA-2026-07-01"],
        )

        for field in (
            "completion_requirement_count",
            "completion_requirement_names",
            "condition_counts",
            "condition_node_count",
            "minimum_credit_values",
            "referenced_course_ids",
            "referenced_course_set_ids",
            "course_reference_occurrence_count",
            "course_set_reference_occurrence_count",
            "notes_node_count",
            "specializations",
        ):
            self.assertEqual(replay_revision[field], summary["revisions"][0][field])
        self.assertEqual(
            bundle["minimized_source"]["PSYCH-BA-2026-07-01"]["specializations"],
            [
                {
                    "id": "PSYCH",
                    "longName": "Psychology",
                    "status": "Active",
                    "effectiveStartDate": "1901-01-01",
                }
            ],
        )

    def test_evidence_bundle_omits_operational_specialization_metadata(self) -> None:
        payload = fixture()
        specialization = payload["PSYCH-BA-2026-07-01"]["specializations"][0]
        specialization.update(
            {
                "rawSisId": "operational-id",
                "firstTermValid": "1234",
                "evaluateSubplan": True,
                "printOnTranscript": True,
            }
        )
        revisions = discovery.validate_program_payload(payload, program_code="PSYCH-BA")
        summary = discovery.build_summary(
            revisions,
            program_code="PSYCH-BA",
            catalog_id="catalog-1",
            captured_at_utc="2026-11-12T00:00:00Z",
            source_url=discovery.program_url("PSYCH-BA", "catalog-1"),
            canonical_json_sha256="0" * 64,
        )

        bundle = discovery.build_evidence_bundle(summary, revisions)
        minimized = bundle["minimized_source"]["PSYCH-BA-2026-07-01"][
            "specializations"
        ][0]

        self.assertNotIn("rawSisId", minimized)
        self.assertNotIn("firstTermValid", minimized)
        self.assertNotIn("evaluateSubplan", minimized)
        self.assertNotIn("printOnTranscript", minimized)

    def test_evidence_bundle_recursively_omits_nonacademic_rule_metadata(self) -> None:
        payload = fixture()
        requirement = payload["PSYCH-BA-2026-07-01"]["requisites"][
            "requisitesSimple"
        ][0]
        requirement["createdBy"] = "editor@example.edu"
        requirement["operationalToken"] = "internal-123"
        requirement["rules"][0]["sisId"] = "operational-rule-id"
        revisions = discovery.validate_program_payload(payload, program_code="PSYCH-BA")
        summary = discovery.build_summary(
            revisions,
            program_code="PSYCH-BA",
            catalog_id="catalog-1",
            captured_at_utc="2026-11-12T00:00:00Z",
            source_url=discovery.program_url("PSYCH-BA", "catalog-1"),
            canonical_json_sha256="0" * 64,
        )

        bundle = discovery.build_evidence_bundle(summary, revisions)
        minimized_requirement = bundle["minimized_source"][
            "PSYCH-BA-2026-07-01"
        ]["requisites"]["requisitesSimple"][0]

        self.assertNotIn("createdBy", minimized_requirement)
        self.assertNotIn("operationalToken", minimized_requirement)
        self.assertNotIn("sisId", minimized_requirement["rules"][0])
        self.assertEqual(
            minimized_requirement["rules"][0]["condition"], "allOf"
        )

    def test_cli_rejects_invalid_offline_capture_timestamp(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            input_path = Path(directory) / "payload.json"
            input_path.write_text(json.dumps(fixture()), encoding="utf-8")
            result = subprocess.run(
                [
                    "python3",
                    str(SCRIPT),
                    "--program-code",
                    "PSYCH-BA",
                    "--catalog-id",
                    "catalog-1",
                    "--input-json",
                    str(input_path),
                    "--captured-at-utc",
                    "not-a-utc-time",
                ],
                capture_output=True,
                check=False,
                text=True,
            )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("--captured-at-utc", result.stderr)

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
