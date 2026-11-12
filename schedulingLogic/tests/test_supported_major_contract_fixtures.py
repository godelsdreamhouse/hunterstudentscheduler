import json
from pathlib import Path
import unittest

import models
from input_builder import build_student_profile


FIXTURE_PATH = (
    Path(__file__).resolve().parents[2]
    / "test-fixtures"
    / "contracts"
    / "supported-major-audits.json"
)


class SupportedMajorContractFixtureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contract = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))

    def test_normalized_frontend_payloads_build_scheduler_profiles(self):
        expected_majors = {
            "computer-science": models.Major.CS,
            "mathematics": models.Major.MATH,
            "political-science": models.Major.POLISCI,
        }

        for fixture in self.contract["cases"]:
            with self.subTest(fixture=fixture["id"]):
                profile = build_student_profile(
                    fixture["expected_parser_payload"],
                    self.contract["expected_ui_payload"],
                )

                self.assertEqual(
                    profile.student_program.majors,
                    [expected_majors[fixture["id"]]],
                )
                self.assertEqual(profile.emplid, 24681357)
                self.assertIn(
                    models.CourseId("ENGL", 12000),
                    profile.classes_taken,
                )
                self.assertEqual(len(profile.requirements_needed), 1)
                requirement = next(iter(profile.requirements_needed))
                expected_requirement = fixture["expected_parser_payload"][
                    "requirements_needed"
                ][0]
                self.assertEqual(
                    requirement.credits_needed,
                    expected_requirement["credits_needed"],
                )
                self.assertEqual(
                    requirement.fulfilled_by,
                    frozenset(
                        models.CourseId(
                            course["subject_area"],
                            course["catalog_number"],
                        )
                        for course in expected_requirement["fulfilled_by"]
                    ),
                )
                self.assertEqual(
                    profile.preferences.unavailable[0].day,
                    models.Day.MONDAY,
                )
                self.assertEqual(profile.preferences.credit_lower_bound, 12)
                self.assertEqual(profile.preferences.credit_upper_bound, 15)


if __name__ == "__main__":
    unittest.main()
