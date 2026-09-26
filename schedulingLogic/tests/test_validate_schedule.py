from copy import deepcopy
from itertools import combinations
import os
import unittest
from unittest.mock import patch

import models
from validate_schedule import validate_schedule


def section(number=1, start=540, end=600, credits=3):
    return models.Section(
        course=models.Course(models.CourseId("CSCI", 10000 + number), credits=credits),
        class_num=number,
        meetings=[models.Meeting(models.Day.MONDAY, start, end)],
    )


class ValidatorTests(unittest.TestCase):
    def setUp(self):
        self.student = models.StudentProfile(
            0, models.StudentProgram(), models.Prefrences(
                credit_lower_bound=3, credit_upper_bound=6,
            ),
        )
        self.first = section()
        self.second = section(2, 600, 660)
        self.candidates = [self.first, self.second]

    def check(self, selected):
        return validate_schedule(self.student, self.candidates, models.Schedule(selected))

    def test_back_to_back_and_exact_credit_bounds(self):
        self.assertEqual(self.check([self.first]), [])
        self.assertEqual(self.check(self.candidates), [])

    def test_empty_schedule_respects_lower_bound(self):
        self.assertIn("CREDIT_BOUNDS_VIOLATION", self.check([]))
        self.student.preferences.credit_lower_bound = 0
        self.assertEqual(self.check([]), [])

    def test_credit_limits_and_fractional_credits(self):
        self.student.preferences.credit_upper_bound = 5.5
        self.assertIn("CREDIT_BOUNDS_VIOLATION", self.check(self.candidates))
        self.second.course.credits = 2.5
        self.assertEqual(self.check(self.candidates), [])

    def test_overlap_on_any_meeting_and_distinct_days(self):
        self.second.meetings.append(models.Meeting(models.Day.MONDAY, 599, 620))
        self.assertIn("SECTION_TIME_CONFLICT", self.check(self.candidates))
        self.second.meetings[-1].day = models.Day.TUESDAY
        self.assertEqual(self.check(self.candidates), [])

    def test_blocked_time_and_boundary(self):
        blocked = models.Meeting(models.Day.MONDAY, 600, 630)
        self.student.preferences.unavailable = [blocked]
        self.assertEqual(self.check([self.first]), [])
        blocked.start_time = 599
        self.assertIn("BLOCKED_TIME_CONFLICT", self.check([self.first]))

    def test_prerequisites_and_completed_courses(self):
        prerequisite = models.CourseId("MATH", 15000)
        self.first.course.prereqs = [prerequisite]
        self.assertIn("UNMET_PREREQUISITE", self.check([self.first]))
        self.student.classes_taken.add(prerequisite)
        self.assertEqual(self.check([self.first]), [])
        self.student.classes_taken.add(self.first.course.course_id)
        self.assertIn("COMPLETED_COURSE_SELECTED", self.check([self.first]))

    def test_requested_course_and_completed_exception(self):
        requested = self.second.course.course_id
        self.student.preferences.specific_courses.add(requested)
        self.assertIn("MISSING_REQUESTED_COURSE", self.check([self.first]))
        self.assertEqual(self.check(self.candidates), [])
        self.student.classes_taken.add(requested)
        self.assertEqual(self.check([self.first]), [])

    def test_unknown_or_modified_section(self):
        self.assertIn("UNKNOWN_SECTION", self.check([section(99)]))
        changed = deepcopy(self.first)
        changed.course.credits = 0
        self.assertIn("SECTION_DATA_MISMATCH", self.check([changed]))

    def test_duplicate_section_and_course(self):
        self.assertIn("DUPLICATE_SECTION", self.check([self.first, self.first]))
        self.second.course.course_id = self.first.course.course_id
        self.assertIn("DUPLICATE_COURSE", self.check(self.candidates))

    def test_candidate_ids(self):
        self.second.class_num = self.first.class_num
        self.assertIn("DUPLICATE_CANDIDATE_ID", self.check([self.first]))
        for value in (0, -1, True):
            with self.subTest(value=value):
                self.second.class_num = value
                self.assertIn("INVALID_SECTION_ID", self.check([self.first]))

    def test_bad_credits_and_bounds(self):
        for value in (-1, 0.25, float("nan"), float("inf"), "bad"):
            with self.subTest(credit=value):
                self.first.course.credits = value
                self.assertIn("INVALID_COURSE_CREDITS", self.check([self.first]))
        self.first.course.credits = 3
        for value in (-1, 2, float("nan"), float("inf")):
            with self.subTest(upper=value):
                self.student.preferences.credit_upper_bound = value
                self.assertIn("INVALID_CREDIT_BOUNDS", self.check([self.first]))

    def test_bad_meeting_and_blocked_time(self):
        for start, end in ((600, 600), (601, 600), (-1, 600), (600, 1441)):
            with self.subTest(start=start, end=end):
                self.first.meetings = [models.Meeting(models.Day.MONDAY, start, end)]
                self.assertIn("INVALID_MEETING", self.check([self.first]))
        self.first.meetings = []
        self.student.preferences.unavailable = [models.Meeting(models.Day.MONDAY, 5, 4)]
        self.assertIn("INVALID_BLOCKED_TIME", self.check([self.first]))

    def test_no_meetings_and_shared_tags_are_not_rejected(self):
        self.first.meetings = []
        self.first.instruction_modality = models.Modality.ASYNCHRONOUS
        self.first.course.tags = self.second.course.tags = {"elective"}
        self.assertEqual(self.check(self.candidates), [])

    def test_does_not_mutate_inputs(self):
        before = deepcopy((self.student, self.candidates))
        self.check(self.candidates)
        self.assertEqual((self.student, self.candidates), before)

    def test_credit_encoding_matches_direct_check_for_small_instances(self):
        from constraints_new import add_credit_bounds
        from pysat.solvers import Solver

        self.candidates = [section(i + 1, credits=c) for i, c in enumerate((0.5, 1, 2.5, 3))]
        for candidate in self.candidates:
            candidate.meetings = []
        for lower, upper in ((0, 0), (0.5, 3), (3, 3), (3.5, 6), (7, 7)):
            self.student.preferences.credit_lower_bound = lower
            self.student.preferences.credit_upper_bound = upper
            hard = []
            add_credit_bounds(self.student, self.candidates, hard, top_id=4)
            with Solver(bootstrap_with=hard) as solver:
                for size in range(5):
                    for chosen in combinations(self.candidates, size):
                        selected_ids = {s.class_num for s in chosen}
                        assumptions = [
                            s.class_num if s.class_num in selected_ids else -s.class_num
                            for s in self.candidates
                        ]
                        with self.subTest(bounds=(lower, upper), selected=selected_ids):
                            self.assertEqual(solver.solve(assumptions=assumptions), not self.check(list(chosen)))


class ApiValidationTests(unittest.TestCase):
    def run_api(self, overlapping):
        import api

        student = models.StudentProfile(
            0, models.StudentProgram(), models.Prefrences(credit_lower_bound=6, credit_upper_bound=6),
        )
        candidates = [section(), section(2, 599 if overlapping else 600, 660)]
        request = api.GenerateScheduleRequest(
            parser_payload={}, ui_payload={}, term_season="FALL", term_year=2026,
        )
        # Force both sections via an intentionally incomplete encoding. The
        # real solver must succeed, while the independent checker catches it.
        with (
            patch.dict(os.environ, {"DATABASE_URL": "postgresql://unused"}),
            patch.object(api, "build_student_profile", return_value=student),
            patch.object(api.psycopg, "connect"),
            patch.object(api, "get_candidate_sections", return_value=candidates),
            patch.object(api, "constraints_new", return_value=([[1], [2]], [], {})),
        ):
            return api.generate_schedule(request)

    def test_invalid_solver_result_is_internal_error(self):
        with self.assertLogs("api", level="ERROR"):
            result = self.run_api(overlapping=True)
        self.assertEqual(result["error_code"], "SCHEDULE_VALIDATION_FAILED")
        self.assertEqual(result["sections"], [])
        self.assertEqual(result["error_details"], {})

    def test_valid_solver_result_is_returned(self):
        result = self.run_api(overlapping=False)
        self.assertIsNone(result["error_code"])
        self.assertEqual(len(result["sections"]), 2)


if __name__ == "__main__":
    unittest.main()
