import unittest

import models
from constraints_new import constraints_new
from pysat.solvers import Solver


REQUIREMENT_NAME = "Life & Physical Sciences"


def _is_satisfiable(credits_needed: int) -> bool:
    course_id = models.CourseId("ANTHP", 10100)
    course = models.Course(
        course_id=course_id,
        course_title="Synthetic four-credit course",
        credits=4,
        tags={REQUIREMENT_NAME},
    )
    section = models.Section(
        course=course,
        class_num=1,
        section_code="SYNTHETIC",
        meetings=[],
    )
    requirement = models.Requirement(
        name=REQUIREMENT_NAME,
        attribute="synthetic_requirement",
        fulfilled_by=frozenset({course_id}),
        credits_needed=credits_needed,
    )
    student = models.StudentProfile(
        emplid=0,
        student_program=models.StudentProgram(majors=[models.Major.CS]),
        preferences=models.Prefrences(
            credit_lower_bound=4,
            credit_upper_bound=4,
        ),
        requirements_needed={requirement},
    )

    hard, _soft, _day_literals = constraints_new(student, [section])
    with Solver(bootstrap_with=hard) as solver:
        return solver.solve()


class RequirementCreditCapCharacterizationTests(unittest.TestCase):
    def test_four_credit_course_exceeds_three_credit_requirement_cap(self):
        self.assertFalse(_is_satisfiable(credits_needed=3))

    def test_same_course_satisfies_four_credit_requirement_cap(self):
        self.assertTrue(_is_satisfiable(credits_needed=4))


if __name__ == "__main__":
    unittest.main()
