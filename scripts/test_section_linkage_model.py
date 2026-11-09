"""Synthetic contract tests for the proposed linked-section representation."""

from __future__ import annotations

import copy
import importlib.util
import json
import sys
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("section_linkage_model.py")
SPEC = importlib.util.spec_from_file_location("section_linkage_model", SCRIPT)
assert SPEC and SPEC.loader
linkage = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = linkage
SPEC.loader.exec_module(linkage)

AssociationKey = linkage.AssociationKey
LinkageValidationError = linkage.LinkageValidationError
normalize_groups = linkage.normalize_groups
normalize_section = linkage.normalize_section
valid_component_combinations = linkage.valid_component_combinations


def source(value: str) -> dict[str, str]:
    return {"_text": value}


def requirement(code: str, *, optional: str = "N") -> dict[str, object]:
    return {
        "SSR_COMPONENT": source(code),
        "OPTIONAL_SECTION": source(optional),
        "AUTO_CREATE_CMPNT": source("N"),
        "CONTACT_HOURS": source("3"),
        "FINAL_EXAM": source("N"),
        "WEEK_WORKLOAD_HRS": source("3"),
    }


def section(
    number: str,
    component: str,
    required: list[str],
    *,
    course_id: str = "course-1",
    term_id: str = "1269",
    session: str = "1",
    associated_class: str = "10",
    registration_mode: str = "Enrollment Section",
    auto_enroll: tuple[str, ...] = (),
    components_as_object: bool = False,
    association_component: str | None = None,
    optional_components: frozenset[str] = frozenset(),
    primary_instruction: str | None = "__self__",
) -> dict[str, object]:
    declarations = [
        requirement(code, optional="Y" if code in optional_components else "N")
        for code in required
    ]
    component_value: object = declarations[0] if components_as_object else declarations
    result: dict[str, object] = {
        "id": f"source-{course_id}-{session}-{associated_class}-{number}",
        "courseId": course_id,
        "sectionNumber": number,
        "sectionType": {
            "LEC": "Lecture",
            "LAB": "Laboratory",
            "DIS": "Discussion",
            "REC": "Recitation",
            "CLN": "Clinical",
            "FLD": "Field Studies",
            "IND": "Independent Study",
            "INT": "Internship",
            "MSG": "Message",
            "PRA": "Practicum",
            "RSC": "Research",
            "SEM": "Seminar",
            "THE": "Thesis Research",
            "TUT": "Tutorial",
        }.get(component, component),
        "registrationMode": registration_mode,
        "customFields": {
            "associatedClass": associated_class,
            "autoEnrollSect1": auto_enroll[0] if auto_enroll else "",
            "autoEnrollSect2": auto_enroll[1] if len(auto_enroll) > 1 else "",
            "primInstrSect": (
                number if primary_instruction == "__self__" else primary_instruction or ""
            ),
            "_classAssociation": {
                "STRM": source(term_id),
                "SESSION_CODE": source(session),
                "ASSOCIATED_CLASS": source(associated_class),
                "SSR_COMPONENT": source(
                    association_component
                    or ("LEC" if "LEC" in required else required[0])
                ),
                "CLASS_COMPONENT": component_value,
            },
        },
        "unmodeledPublicField": {"must": ["survive", 1]},
    }
    return result


class NormalizationTests(unittest.TestCase):
    def test_standalone_lecture_accepts_object_declaration_losslessly(self) -> None:
        raw = section("01", "LEC", ["LEC"], components_as_object=True)
        normalized = normalize_section(raw, expected_course_id="course-1", expected_term_id="1269")

        self.assertEqual(normalized.key, AssociationKey("course-1", "1269", "1", "10"))
        self.assertEqual(normalized.component_code, "LEC")
        self.assertEqual(normalized.association_component_code, "LEC")
        self.assertEqual(normalized.required_components[0].component_code, "LEC")
        self.assertEqual(normalized.source_payload, raw)
        self.assertIsNot(normalized.source_payload, raw)

    def test_array_declaration_preserves_all_required_components_and_roles(self) -> None:
        raw = section(
            "01",
            "LEC",
            ["LEC", "LAB", "REC"],
            registration_mode="Non-Enrollment Section",
            auto_enroll=("1L01", "1R01"),
        )
        normalized = normalize_section(raw, expected_course_id="course-1", expected_term_id="1269")

        self.assertEqual(
            [item.component_code for item in normalized.required_components],
            ["LEC", "LAB", "REC"],
        )
        self.assertEqual(normalized.registration_mode, "Non-Enrollment Section")
        self.assertEqual(normalized.auto_enroll_section_numbers, ("1L01", "1R01"))

    def test_section_type_and_association_component_are_distinct(self) -> None:
        raw = section(
            "01",
            "LEC",
            ["DIS", "LEC"],
            registration_mode="Non-Enrollment Section",
            association_component="DIS",
        )
        normalized = normalize_section(raw, expected_course_id="course-1", expected_term_id="1269")

        self.assertEqual(normalized.component_code, "LEC")
        self.assertEqual(normalized.association_component_code, "DIS")

    def test_missing_or_ambiguous_grouping_inputs_fail_closed(self) -> None:
        cases = []
        for path in ("associated", "session", "components"):
            raw = section("01", "LEC", ["LEC"])
            association = raw["customFields"]["_classAssociation"]  # type: ignore[index]
            if path == "associated":
                raw["customFields"].pop("associatedClass")  # type: ignore[union-attr]
            elif path == "session":
                association.pop("SESSION_CODE")  # type: ignore[union-attr]
            else:
                association.pop("CLASS_COMPONENT")  # type: ignore[union-attr]
            cases.append(raw)

        for raw in cases:
            with self.subTest(raw=raw):
                with self.assertRaises(LinkageValidationError):
                    normalize_section(raw, expected_course_id="course-1", expected_term_id="1269")

    def test_unknown_component_and_mismatched_identity_fail_closed(self) -> None:
        cases = [
            section("01", "XYZ", ["XYZ"]),
            section("01", "LEC", ["LEC"], course_id="other"),
            section("01", "LEC", ["LEC"], term_id="1268"),
        ]
        for raw in cases:
            with self.subTest(raw=raw):
                with self.assertRaises(LinkageValidationError):
                    normalize_section(raw, expected_course_id="course-1", expected_term_id="1269")

    def test_every_observed_component_type_maps_to_its_source_display_type(self) -> None:
        for index, code in enumerate(sorted(linkage.OBSERVED_COMPONENT_CODES)):
            with self.subTest(component=code):
                raw = section(f"{index:02}", code, [code])
                normalized = normalize_section(
                    raw, expected_course_id="course-1", expected_term_id="1269"
                )
                self.assertEqual(normalized.component_code, code)


class CombinationTests(unittest.TestCase):
    def test_one_lecture_with_multiple_discussion_choices(self) -> None:
        sections = [
            section("01", "LEC", ["LEC", "DIS"], registration_mode="Non-Enrollment Section"),
            section("1D01", "DIS", ["LEC", "DIS"]),
            section("1D02", "DIS", ["LEC", "DIS"]),
            section("1D03", "DIS", ["LEC", "DIS"]),
        ]
        group = normalize_groups(
            sections, expected_course_id="course-1", expected_term_id="1269"
        ).groups[0]

        self.assertEqual(
            valid_component_combinations(group),
            (("01", "1D01"), ("01", "1D02"), ("01", "1D03")),
        )

    def test_lecture_lab_recitation_forms_cartesian_choices_within_group(self) -> None:
        required = ["LEC", "LAB", "REC"]
        sections = [
            section("01", "LEC", required, registration_mode="Non-Enrollment Section"),
            section("1L01", "LAB", required),
            section("1L02", "LAB", required),
            section("1R01", "REC", required),
            section("1R02", "REC", required),
        ]
        group = normalize_groups(
            sections, expected_course_id="course-1", expected_term_id="1269"
        ).groups[0]

        self.assertEqual(
            valid_component_combinations(group),
            (
                ("01", "1L01", "1R01"),
                ("01", "1L01", "1R02"),
                ("01", "1L02", "1R01"),
                ("01", "1L02", "1R02"),
            ),
        )

    def test_clinical_is_not_special_cased_as_lab_discussion_or_recitation(self) -> None:
        required = ["LEC", "LAB", "CLN"]
        group = normalize_groups(
            [
                section("01", "LEC", required),
                section("1L01", "LAB", required),
                section("1C01", "CLN", required),
                section("1C02", "CLN", required),
            ],
            expected_course_id="course-1",
            expected_term_id="1269",
        ).groups[0]
        self.assertEqual(
            valid_component_combinations(group),
            (("01", "1L01", "1C01"), ("01", "1L01", "1C02")),
        )

    def test_same_associated_class_is_scoped_by_course_term_and_session(self) -> None:
        first = normalize_groups(
            [section("01", "LEC", ["LEC"], associated_class="1")],
            expected_course_id="course-1",
            expected_term_id="1269",
        ).groups[0]
        second = normalize_groups(
            [section("01", "LEC", ["LEC"], course_id="course-2", associated_class="1")],
            expected_course_id="course-2",
            expected_term_id="1269",
        ).groups[0]
        third = normalize_groups(
            [section("02", "LEC", ["LEC"], session="2", associated_class="1")],
            expected_course_id="course-1",
            expected_term_id="1269",
        ).groups[0]
        fourth = normalize_groups(
            [section("01", "LEC", ["LEC"], term_id="1272", associated_class="1")],
            expected_course_id="course-1",
            expected_term_id="1272",
        ).groups[0]

        self.assertEqual(len({first.key, second.key, third.key, fourth.key}), 4)

    def test_unresolved_required_component_and_auto_enroll_target_fail_closed(self) -> None:
        with self.assertRaisesRegex(LinkageValidationError, "missing required components: LAB"):
            normalize_groups(
                [section("01", "LEC", ["LEC", "LAB"])],
                expected_course_id="course-1",
                expected_term_id="1269",
            ).require_clean()
        with self.assertRaisesRegex(LinkageValidationError, "unresolved auto-enroll targets"):
            normalize_groups(
                [section("01", "LEC", ["LEC"], auto_enroll=("MISSING",))],
                expected_course_id="course-1",
                expected_term_id="1269",
            ).require_clean()

    def test_inconsistent_declarations_within_one_group_fail_closed(self) -> None:
        sections = [
            section("01", "LEC", ["LEC", "LAB"]),
            section("1L01", "LAB", ["LAB", "LEC", "REC"]),
        ]
        with self.assertRaisesRegex(LinkageValidationError, "inconsistent requirements"):
            normalize_groups(
                sections, expected_course_id="course-1", expected_term_id="1269"
            ).require_clean()

    def test_inconsistent_association_components_within_one_group_fail_closed(self) -> None:
        sections = [
            section("01", "LEC", ["LEC", "LAB"], association_component="LEC"),
            section("1L01", "LAB", ["LEC", "LAB"], association_component="LAB"),
        ]
        with self.assertRaisesRegex(
            LinkageValidationError, "inconsistent association components"
        ):
            normalize_groups(
                sections, expected_course_id="course-1", expected_term_id="1269"
            ).require_clean()

    def test_declaration_order_is_not_treated_as_a_semantic_difference(self) -> None:
        sections = [
            section("01", "LEC", ["LEC", "LAB"]),
            section("1L01", "LAB", ["LAB", "LEC"]),
        ]
        groups = normalize_groups(
            sections, expected_course_id="course-1", expected_term_id="1269"
        ).groups
        self.assertEqual(len(groups), 1)

    def test_auto_enroll_evidence_filters_incompatible_lecture_choice(self) -> None:
        required = ["LEC", "DIS"]
        group = normalize_groups(
            [
                section("01", "LEC", required, registration_mode="Non-Enrollment Section"),
                section("02", "LEC", required, registration_mode="Non-Enrollment Section"),
                section("1D01", "DIS", required, auto_enroll=("01",)),
                section("1D02", "DIS", required, auto_enroll=("02",)),
            ],
            expected_course_id="course-1",
            expected_term_id="1269",
        ).groups[0]
        self.assertEqual(
            valid_component_combinations(group),
            (("01", "1D01"), ("02", "1D02")),
        )

    def test_lecture_recitation_explicit_auto_enroll_target(self) -> None:
        required = ["LEC", "REC"]
        group = normalize_groups(
            [
                section(
                    "01",
                    "LEC",
                    required,
                    registration_mode="Non-Enrollment Section",
                ),
                section("1R01", "REC", required, auto_enroll=("01",)),
                section("1R02", "REC", required, auto_enroll=("01",)),
            ],
            expected_course_id="course-1",
            expected_term_id="1269",
        ).groups[0]
        self.assertEqual(
            valid_component_combinations(group),
            (("01", "1R01"), ("01", "1R02")),
        )

    def test_optional_component_can_be_omitted_or_selected(self) -> None:
        required = ["LEC", "LAB"]
        group = normalize_groups(
            [
                section(
                    "01",
                    "LEC",
                    required,
                    optional_components=frozenset({"LAB"}),
                ),
                section(
                    "1L01",
                    "LAB",
                    required,
                    optional_components=frozenset({"LAB"}),
                ),
            ],
            expected_course_id="course-1",
            expected_term_id="1269",
        ).groups[0]
        self.assertEqual(
            valid_component_combinations(group), (("01",), ("01", "1L01"))
        )

    def test_group_without_an_enrollment_section_fails_closed(self) -> None:
        with self.assertRaisesRegex(LinkageValidationError, "no enrollment section"):
            normalize_groups(
                [
                    section(
                        "01",
                        "LEC",
                        ["LEC", "LAB"],
                        registration_mode="Non-Enrollment Section",
                    ),
                    section(
                        "1L01",
                        "LAB",
                        ["LEC", "LAB"],
                        registration_mode="Non-Enrollment Section",
                    ),
                ],
                expected_course_id="course-1",
                expected_term_id="1269",
            ).require_clean()

    def test_combination_without_an_enrollment_section_is_not_viable(self) -> None:
        required = ["LEC", "LAB"]
        group = normalize_groups(
            [
                section(
                    "01",
                    "LEC",
                    required,
                    registration_mode="Non-Enrollment Section",
                ),
                section(
                    "1L01",
                    "LAB",
                    required,
                    registration_mode="Non-Enrollment Section",
                ),
                section("1L02", "LAB", required),
            ],
            expected_course_id="course-1",
            expected_term_id="1269",
        ).groups[0]
        self.assertEqual(valid_component_combinations(group), (("01", "1L02"),))

    def test_self_and_same_component_auto_enroll_targets_fail_closed(self) -> None:
        invalid_groups = (
            [section("01", "LEC", ["LEC"], auto_enroll=("01",))],
            [
                section("01", "LEC", ["LEC"], auto_enroll=("02",)),
                section("02", "LEC", ["LEC"]),
            ],
        )
        for sections in invalid_groups:
            with self.subTest(sections=sections):
                with self.assertRaises(LinkageValidationError):
                    normalize_groups(
                        sections,
                        expected_course_id="course-1",
                        expected_term_id="1269",
                    ).require_clean()

    def test_auto_enroll_target_in_another_association_group_fails_closed(self) -> None:
        sections = [
            section("01", "LEC", ["LEC"], associated_class="1"),
            section(
                "02",
                "LEC",
                ["LEC"],
                associated_class="2",
                auto_enroll=("01",),
            ),
        ]
        with self.assertRaisesRegex(LinkageValidationError, "outside its association group"):
            normalize_groups(
                sections, expected_course_id="course-1", expected_term_id="1269"
            ).require_clean()

    def test_unresolved_primary_instruction_section_is_quarantined(self) -> None:
        result = normalize_groups(
            [
                section(
                    "01",
                    "LEC",
                    ["LEC"],
                    primary_instruction="MISSING",
                )
            ],
            expected_course_id="course-1",
            expected_term_id="1269",
        )
        self.assertEqual(result.groups, ())
        self.assertEqual(len(result.quarantined), 1)
        self.assertIn("unresolved primary instruction section", result.quarantined[0].reason)

    def test_mutually_exclusive_auto_enroll_targets_are_quarantined(self) -> None:
        required = ["LEC", "LAB"]
        result = normalize_groups(
            [
                section("01", "LEC", required, auto_enroll=("1L01", "1L02")),
                section("1L01", "LAB", required),
                section("1L02", "LAB", required),
            ],
            expected_course_id="course-1",
            expected_term_id="1269",
        )
        self.assertEqual(result.groups, ())
        self.assertEqual(len(result.quarantined), 1)
        self.assertIn("mutually exclusive alternatives", result.quarantined[0].reason)

    def test_malformed_group_does_not_suppress_an_unrelated_valid_group(self) -> None:
        valid = section("01", "LEC", ["LEC"], associated_class="1")
        malformed = section("02", "LEC", ["LEC"], associated_class="2")
        malformed["customFields"]["_classAssociation"].pop("CLASS_COMPONENT")  # type: ignore[index]

        result = normalize_groups(
            [valid, malformed],
            expected_course_id="course-1",
            expected_term_id="1269",
        )

        self.assertEqual(tuple(group.key.associated_class for group in result.groups), ("1",))
        self.assertEqual(len(result.quarantined), 1)
        self.assertEqual(result.quarantined[0].key.associated_class, "2")  # type: ignore[union-attr]
        self.assertIn("CLASS_COMPONENT", result.quarantined[0].reason)

    def test_ungroupable_section_does_not_suppress_valid_groups(self) -> None:
        valid = section("01", "LEC", ["LEC"], associated_class="1")
        ungroupable = section("02", "LEC", ["LEC"], associated_class="2")
        ungroupable["customFields"]["_classAssociation"] = {}  # type: ignore[index]

        result = normalize_groups(
            [valid, ungroupable],
            expected_course_id="course-1",
            expected_term_id="1269",
        )

        self.assertEqual(tuple(group.key.associated_class for group in result.groups), ("1",))
        self.assertEqual(len(result.quarantined), 1)
        self.assertIsNone(result.quarantined[0].key)
        self.assertIn("STRM", result.quarantined[0].reason)

    def test_malformed_duplicate_source_id_quarantines_the_valid_group(self) -> None:
        valid = section("01", "LEC", ["LEC"], associated_class="1")
        malformed = section("02", "LEC", ["LEC"], associated_class="2")
        malformed["id"] = valid["id"]
        malformed["customFields"]["_classAssociation"] = {}  # type: ignore[index]

        result = normalize_groups(
            [valid, malformed],
            expected_course_id="course-1",
            expected_term_id="1269",
        )

        self.assertEqual(result.groups, ())
        self.assertEqual(len(result.quarantined), 2)
        self.assertTrue(
            any("source section IDs must be unique" in item.reason for item in result.quarantined)
        )

    def test_malformed_duplicate_section_number_quarantines_every_affected_group(self) -> None:
        valid = section("01", "LEC", ["LEC"], associated_class="1")
        malformed = section("01", "LEC", ["LEC"], associated_class="2")
        malformed["customFields"]["_classAssociation"].pop("CLASS_COMPONENT")  # type: ignore[index]

        result = normalize_groups(
            [valid, malformed],
            expected_course_id="course-1",
            expected_term_id="1269",
        )

        self.assertEqual(result.groups, ())
        self.assertEqual(len(result.quarantined), 2)
        self.assertTrue(
            any("section numbers must be unique" in item.reason for item in result.quarantined)
        )

    def test_every_raw_record_is_preserved_in_a_group_or_quarantine(self) -> None:
        valid = section("01", "LEC", ["LEC"], associated_class="1")
        malformed = section("02", "LEC", ["LEC"], associated_class="2")
        malformed["customFields"]["_classAssociation"] = {}  # type: ignore[index]
        expected = copy.deepcopy([valid, malformed])

        result = normalize_groups(
            [valid, malformed],
            expected_course_id="course-1",
            expected_term_id="1269",
        )
        represented = [
            section.source_payload
            for group in result.groups
            for section in group.sections
        ] + [
            payload
            for quarantine in result.quarantined
            for payload in quarantine.source_payloads
        ]

        self.assertEqual(
            sorted(json.dumps(item, sort_keys=True) for item in represented),
            sorted(json.dumps(item, sort_keys=True) for item in expected),
        )
        malformed["unmodeledPublicField"] = "changed"
        self.assertNotEqual(result.quarantined[0].source_payloads[0], malformed)

    def test_source_payload_copy_is_insulated_from_later_input_mutation(self) -> None:
        raw = section("01", "LEC", ["LEC"])
        normalized = normalize_section(raw, expected_course_id="course-1", expected_term_id="1269")
        expected = copy.deepcopy(raw)
        raw["unmodeledPublicField"] = "changed"
        self.assertEqual(normalized.source_payload, expected)


if __name__ == "__main__":
    unittest.main()
