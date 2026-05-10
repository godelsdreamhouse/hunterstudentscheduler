import os
import psycopg
from pysat.formula import WCNF
from pysat.examples.rc2 import RC2

from input_builder import build_student_profile
from candidate_builder import get_candidate_sections
from constraints_new import constraints_new
from wcnf import write_wcnf

parser_payload = {
    "majors": ["CS"],
    "classes_taken": [
        {"subject_area": "CSCI", "catalog_number": 23500},
        {"subject_area": "CSCI", "catalog_number": 16000},
    ],
    "requirements_needed": [
        {
            "name": "CS Core",
            "attribute": "CS Major Core",
            "elective_credits_needed": 0,
            "fulfilled_by": [
                {
                    "course_id": {"subject_area": "CSCI", "catalog_number": 33500},
                    "course_title": "Software Analysis and Design III",
                    "departments": ["Computer Science"],
                    "academic_career": "UNDERGRADUATE",
                    "credits": 3,
                    "description": "",
                    "tags": [],
                    "prereqs": [{"subject_area": "CSCI", "catalog_number": 23500}],
                },
                {
                    "course_id": {"subject_area": "CSCI", "catalog_number": 26000},
                    "course_title": "Computer Architecture II",
                    "departments": ["Computer Science"],
                    "academic_career": "UNDERGRADUATE",
                    "credits": 3,
                    "description": "",
                    "tags": [],
                    "prereqs": [{"subject_area": "CSCI", "catalog_number": 16000}],
                },
            ],
        }
    ],
}

ui_payload = {
    "emplid": 23942520,
    "credit_lower_bound": 12.0,
    "credit_upper_bound": 16.0,
    "unavailable": [],
    "morning": True,
    "afternoon": False,
    "evening": False,
    "less_gaps": True,
    "less_days": True,
    "in_person": True,
    "remote": False,
    "major_electives_needed": [],
}

if "DATABASE_URL" not in os.environ:
    os.environ["DATABASE_URL"] = "postgresql://postgres:postgres@localhost:5432/watchtower"

student = build_student_profile(parser_payload, ui_payload)

with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
    sections = get_candidate_sections(conn, student, term_season="FALL", term_year=2026)

print("candidates:", len(sections))
if not sections:
    raise SystemExit("No candidate sections returned.")

hard, soft, _ = constraints_new(student, sections)
write_wcnf("constraints_db.wcnf", hard, soft)

w = WCNF(from_file="constraints_db.wcnf")
with RC2(w) as rc2:
    model = rc2.compute()
    print("cost:", rc2.cost)

by_num = {s.class_num: s for s in sections}
chosen = sorted(v for v in model if v > 0 and v in by_num)

print("chosen class_nums:", chosen)
print("chosen count:", len(chosen))

for n in chosen:
    s = by_num[n]
    cid = s.course.course_id
    print(f"{n}: {cid.subject_area} {cid.catalog_number} sec {s.section_code} tags={sorted(s.course.tags)}")
