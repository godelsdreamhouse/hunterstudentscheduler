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
    prereqs: list[models.CourseId] = []
    for p in x.get("prereqs", []):
        # Supports either {"subject_area": "...", "catalog_number": ...}
        # or ["SUBJ", 12345] payload forms.
        if isinstance(p, dict):
            prereqs.append(_to_course_id(p))
        else:
            prereqs.append(models.CourseId(subject_area=p[0], catalog_number=int(p[1])))

    return models.Course(
        course_id=_to_course_id(x["course_id"]),
        course_title=x["course_title"],
        departments=list(x.get("departments", [])),
        academic_career=models.AcademicCareer(x.get("academic_career", "UNDERGRADUATE")),
        credits=int(x.get("credits", 3)),
        description=x.get("description", ""),
        tags=set(x.get("tags", x.get("fulfillment_tags", []))),
        prereqs=prereqs,
    )


def _to_requirement(x: dict) -> models.Requirement:
    return models.Requirement(
        name=x["name"],
        attribute=x.get("attribute", ""),
        fulfilled_by=[_to_course(c) for c in x.get("fulfilled_by", [])],
        elective_credits_needed=int(x.get("elective_credits_needed", 0)),
    )


def _to_major(x) -> models.Major:
    # Current model expects enum `Major`, not a dataclass payload.
    if isinstance(x, models.Major):
        return x
    if isinstance(x, str):
        raw = x.strip()
        by_name = raw.upper()
        if by_name in models.Major.__members__:
            return models.Major[by_name]
        for m in models.Major:
            if raw.lower() in {m.value.lower(), m.name.lower()}:
                return m
    raise ValueError(f"Unsupported major payload: {x!r}")


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
    raw_majors = parser_payload.get("majors")
    if raw_majors is None:
        raw_majors = parser_payload.get("major", [])
    if isinstance(raw_majors, (str, models.Major)):
        raw_majors = [raw_majors]
    majors = [_to_major(m) for m in raw_majors]

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

    elective_prefrences = {
        _to_course_id(c)
        for c in ui_payload.get("major_electives_needed", [])
    }

    return models.StudentProfile(
        emplid=int(ui_payload["emplid"]),
        student_program=models.StudentProgram(majors=majors),
        preferences=preferences,
        classes_taken=classes_taken,
        # TODO(Model-Mismatch): StudentProfile annotates this as set[Requirement],
        # but Requirement is mutable/unhashable. Keeping list runtime behavior for now.
        requirements_needed=requirements_needed,
        elective_prefrences=elective_prefrences,
    )
