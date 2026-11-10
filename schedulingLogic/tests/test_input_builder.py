import unittest

import models
from input_builder import build_student_profile


class DegreeWorksToSchedulerContractTests(unittest.TestCase):
    def test_normalized_audit_and_preferences_build_a_profile(self):
        parser_payload = {
            "majors": ["CS"],
            "classes_taken": [
                {"subject_area": "CSCI", "catalog_number": 12700},
            ],
            "requirements_needed": [
                {
                    "name": "Software Analysis and Design II",
                    "attribute": "major_core",
                    "credits_needed": 3,
                    "fulfilled_by": [
                        {"subject_area": "CSCI", "catalog_number": 33500},
                    ],
                },
            ],
            "major_elective_credits": 6,
            "general_elective_credits": 3,
        }
        ui_payload = {
            "emplid": 12345678,
            "credit_lower_bound": 12,
            "credit_upper_bound": 15,
            "unavailable": [
                {"day": "MONDAY", "start_time": 540, "end_time": 600},
            ],
            "morning": True,
            "afternoon": False,
            "evening": False,
            "less_gaps": True,
            "less_days": True,
            "in_person": True,
            "remote": False,
            "major_electives_needed": [
                {"subject_area": "CSCI", "catalog_number": 39500},
            ],
            "general_electives_needed": [],
            "specific_courses": [
                {"subject_area": "MATH", "catalog_number": 15000},
            ],
            "departmental": ["CSCI"],
        }

        profile = build_student_profile(parser_payload, ui_payload)

        self.assertEqual(profile.emplid, 12345678)
        self.assertEqual(profile.student_program.majors, [models.Major.CS])
        self.assertIn(models.CourseId("CSCI", 12700), profile.classes_taken)
        self.assertIn(models.CourseId("MATH", 15000), profile.preferences.specific_courses)
        self.assertIn(models.CourseId("CSCI", 39500), profile.major_electives)
        self.assertEqual(profile.preferences.unavailable[0].day, models.Day.MONDAY)
        self.assertEqual(profile.preferences.credit_lower_bound, 12)
        self.assertEqual(profile.preferences.credit_upper_bound, 15)
        requirement = next(iter(profile.requirements_needed))
        self.assertEqual(requirement.name, "Software Analysis and Design II")
        self.assertIn(models.CourseId("CSCI", 33500), requirement.fulfilled_by)

    def test_unsupported_major_is_rejected_instead_of_silently_changed(self):
        with self.assertRaisesRegex(ValueError, "Unsupported major payload"):
            build_student_profile(
                {"majors": ["SOCIOLOGY"], "classes_taken": [], "requirements_needed": []},
                {"emplid": 12345678},
            )


if __name__ == "__main__":
    unittest.main()
