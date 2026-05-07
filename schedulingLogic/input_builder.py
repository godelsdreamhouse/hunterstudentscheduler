# micah gentry
# builds StudentProfile from parser + UI payloads

from __future__ import annotations

import models


def _to_course_id(x: dict) -> models.CourseId:
    return models.CourseId(
        subject_area=x["subject_area"],
        catalog_number=int(x["catalog_number"]),
    )


def _to_meeting(x: dict) -> models.Meeting:
    return models.Meeting(
        day=models.Day[x["day"]],  # expects e.g. "MONDAY"
        start_time=int(x["start_time"]),
        end_time=int(x["end_time"]),
    )


def _to_course(x: dict) -> models.Course:
    return models.Course(
        course_id=_to_course_id(x["course_id"]),
        course_title=x["course_title"],
        departments=list(x.get("departments", [])),
        academic_career=models.AcademicCareer(x.get("academic_career", "UNDERGRADUATE")),
        credits=int(x.get("credits", 3)),
        description=x.get("description", ""),
        fulfillment_tags=set(x.get("fulfillment_tags", [])),
        prereqs=[tuple(p) for p in x.get("prereqs", [])],
        coreqs=[tuple(c) for c in x.get("coreqs", [])],
    )


def _to_requirement(x: dict) -> models.Requirement:
    return models.Requirement(
        name=x["name"],
        attribute=x.get("attribute", ""),
        fulfilled_by=[_to_course(c) for c in x.get("fulfilled_by", [])],
    )


def _to_major(x: dict) -> models.Major:
    return models.Major(
        nysed_code=int(x["nysed_code"]),
        concentration_code=x.get("concentration_code", ""),
        dept=x["dept"],
        credits_required=int(x["credits_required"]),
        description=x.get("description", ""),
        required_courses=[tuple(rc) for rc in x.get("required_courses", [])],
    )


def build_student_profile(parser_payload: dict, ui_payload: dict) -> models.StudentProfile:
    """
    parser_payload expected shape (minimal):
    {
      "majors": [...],
      "classes_taken": [{"subject_area":"CSCI","catalog_number":12700}, ...],
      "requirements_needed": [{"name":"...","attribute":"...","fulfilled_by":[...]}]
    }

    ui_payload expected shape (minimal):
    {
      "emplid": 12345678,
      "credit_lower_bound": 12.0,
      "credit_upper_bound": 16.0,
      "unavailable": [{"day":"MONDAY","start_time":720,"end_time":810}],
      "morning": true,
      "afternoon": false,
      "evening": false,
      "less_gaps": true,
      "less_days": true,
      "in_person": true,
      "remote": false,
      "major_electives_needed": false
    }
    """
    majors = [_to_major(m) for m in parser_payload.get("majors", [])]

    preferences = models.Prefrences(
        credit_lower_bound=float(ui_payload.get("credit_lower_bound", 12.0)),
        credit_upper_bound=float(ui_payload.get("credit_upper_bound", 16.0)),
        unavailable=[_to_meeting(m) for m in ui_payload.get("unavailable", [])],
        morning=bool(ui_payload.get("morning", False)),
        afternoon=bool(ui_payload.get("afternoon", False)),
        evening=bool(ui_payload.get("evening", False)),
        less_gaps=bool(ui_payload.get("less_gaps", False)),
        less_days=bool(ui_payload.get("less_days", False)),
        in_person=bool(ui_payload.get("in_person", False)),
        remote=bool(ui_payload.get("remote", False)),
    )

    classes_taken = {
        _to_course_id(c)
        for c in parser_payload.get("classes_taken", [])
    }

    requirements_needed = [
        _to_requirement(r)
        for r in parser_payload.get("requirements_needed", [])
    ]

    return models.StudentProfile(
        emplid=int(ui_payload["emplid"]),
        student_program=models.StudentProgram(majors=majors),
        preferences=preferences,
        classes_taken=classes_taken,
        requirements_needed=requirements_needed,
        major_electives_needed=bool(ui_payload.get("major_electives_needed", False)),
    )
