from __future__ import annotations

import json
import sys
from pathlib import Path

SCHEDULER_DIR = Path(__file__).resolve().parents[1]
if str(SCHEDULER_DIR) not in sys.path:
    sys.path.insert(0, str(SCHEDULER_DIR))

from input_builder import build_student_profile


LANGUAGE_SYMBOLIC_PARSER_PAYLOAD = {
    "majors": ["CS"],
    "classes_taken": [
        {"subject_area": "CHIN", "catalog_number": 10100},
        {"subject_area": "GERMN", "catalog_number": 10200},
        {"subject_area": "GERMN", "catalog_number": 20100},
        {"subject_area": "CSCI", "catalog_number": 33500},
        {"subject_area": "CSCI", "catalog_number": 15000},
        {"subject_area": "MATH", "catalog_number": 15000},
        {"subject_area": "MATH", "catalog_number": 15500},
        {"subject_area": "STAT", "catalog_number": 21300},
    ],
    "requirements_needed": [
        {
            "name": "4th Level Language Course",
            "attribute": "Language Requirement",
            "credits_needed": 3,
            "fulfilled_by": [
                {"subject_area": "ARB", "catalog_number": 20200},
                {"subject_area": "CHIN", "catalog_number": 20200},
                {"subject_area": "GERMN", "catalog_number": 20200},
                {"subject_area": "LAT", "catalog_number": 20100},
            ],
        },
        {
            "name": "Symbolic Computation",
            "attribute": "Symbolic Computation Requirement",
            "credits_needed": 3,
            "fulfilled_by": [
                {"subject_area": "MATH", "catalog_number": 12600},
                {"subject_area": "MATH", "catalog_number": 15400},
                {"subject_area": "MATH", "catalog_number": 38500},
            ],
        },
        {
            "name": "Pluralism and Diversity A",
            "attribute": "Pluralism and Diversity A",
            "credits_needed": 3,
            "fulfilled_by": [
                {"subject_area": "AFPRL", "catalog_number": 10200},
                {"subject_area": "AFPRL", "catalog_number": 24100},
                {"subject_area": "AFPRL", "catalog_number": 24200},
                {"subject_area": "AFPRL", "catalog_number": 32200},
                {"subject_area": "AFPRL", "catalog_number": 39047},
                {"subject_area": "ARB", "catalog_number": 15000},
                {"subject_area": "ARB", "catalog_number": 25000},
                {"subject_area": "ASIAN", "catalog_number": 23052},
                {"subject_area": "CLA", "catalog_number": 20100},
                {"subject_area": "CLA", "catalog_number": 21100},
                {"subject_area": "ECO", "catalog_number": 33000},
                {"subject_area": "ECO", "catalog_number": 33100},
                {"subject_area": "ECO", "catalog_number": 34000},
                {"subject_area": "ENGL", "catalog_number": 31700},
                {"subject_area": "ENGL", "catalog_number": 32400},
                {"subject_area": "ENGL", "catalog_number": 32500},
                {"subject_area": "ENGL", "catalog_number": 32601},
                {"subject_area": "ENGL", "catalog_number": 32700},
                {"subject_area": "FREN", "catalog_number": 26300},
                {"subject_area": "FREN", "catalog_number": 26400},
                {"subject_area": "FREN", "catalog_number": 33800},
                {"subject_area": "FREN", "catalog_number": 35400},
                {"subject_area": "FREN", "catalog_number": 35500},
                {"subject_area": "GEOG", "catalog_number": 15000},
                {"subject_area": "GEOG", "catalog_number": 24100},
                {"subject_area": "GEOG", "catalog_number": 27000},
                {"subject_area": "GEOG", "catalog_number": 27100},
                {"subject_area": "HEBR", "catalog_number": 21100},
                {"subject_area": "HEBR", "catalog_number": 21500},
                {"subject_area": "HEBR", "catalog_number": 22100},
                {"subject_area": "HEBR", "catalog_number": 22400},
                {"subject_area": "HIST", "catalog_number": 12200},
                {"subject_area": "HIST", "catalog_number": 25015},
                {"subject_area": "HIST", "catalog_number": 25022},
                {"subject_area": "JS", "catalog_number": 21500},
                {"subject_area": "JS", "catalog_number": 35008},
                {"subject_area": "LACS", "catalog_number": 34363},
                {"subject_area": "MUSHL", "catalog_number": 10700},
                {"subject_area": "POL", "catalog_number": 26052},
                {"subject_area": "POLSC", "catalog_number": 11500},
                {"subject_area": "POLSC", "catalog_number": 27500},
                {"subject_area": "POLSC", "catalog_number": 32500},
                {"subject_area": "REL", "catalog_number": 25300},
                {"subject_area": "REL", "catalog_number": 32100},
                {"subject_area": "RUSS", "catalog_number": 25614},
                {"subject_area": "SOC", "catalog_number": 30700},
                {"subject_area": "WGS", "catalog_number": 24400},
                {"subject_area": "WGSL", "catalog_number": 29001},
                {"subject_area": "WGSL", "catalog_number": 29300},
            ],
        },
    ],
}


LANGUAGE_SYMBOLIC_UI_PAYLOAD = {
    "emplid": 23942520,
    "credit_lower_bound": 9.0,
    "credit_upper_bound": 17.0,
    "preferences": {
        "open_seats": False,
    },
    "unavailable": [
        {"day": "MONDAY", "start_time": 12 * 60, "end_time": 13 * 60 + 30},
        {"day": "FRIDAY", "start_time": 15 * 60, "end_time": 17 * 60},
    ],
    "morning": False,
    "afternoon": True,
    "evening": False,
    "less_gaps": True,
    "less_days": True,
    "in_person": True,
    "remote": False,
    "major_electives_needed": [
        {"subject_area": "CSCI", "catalog_number": 35300},
        {"subject_area": "CSCI", "catalog_number": 35000},
        {"subject_area": "CSCI", "catalog_number": 37200},
        {"subject_area": "CSCI", "catalog_number": 49355},
    ],
    "general_electives_needed": [],
    "specific_courses": [],
    "departmental": ["Computer Science", "Mathematics"],
}


def build_language_symbolic_student_profile():
    return build_student_profile(
        LANGUAGE_SYMBOLIC_PARSER_PAYLOAD,
        LANGUAGE_SYMBOLIC_UI_PAYLOAD,
    )


if __name__ == "__main__":
    student = build_language_symbolic_student_profile()
    print(json.dumps({
        "classes_taken": len(student.classes_taken),
        "requirements_needed": len(student.requirements_needed),
        "major_electives": [
            {
                "subject_area": c.subject_area,
                "catalog_number": c.catalog_number,
            }
            for c in sorted(
                student.major_electives,
                key=lambda c: (c.subject_area, c.catalog_number),
            )
        ],
        "credit_lower_bound": student.preferences.credit_lower_bound,
        "credit_upper_bound": student.preferences.credit_upper_bound,
    }, indent=2))
