"""Check decoded schedules directly, independently of the SAT encoding.

This checks feasibility against the supplied data, not optimality, catalog
accuracy, or requirement-tag policies. Prerequisites use the current model's
flat AND semantics; credits must be nonnegative multiples of half a credit.
"""

from decimal import Decimal, InvalidOperation
from itertools import combinations

import models


def _decimal(value) -> Decimal | None:
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None
    return result if result.is_finite() else None


def _valid_meeting(meeting: models.Meeting) -> bool:
    return (
        isinstance(meeting.day, models.Day)
        and type(meeting.start_time) is int
        and type(meeting.end_time) is int
        and 0 <= meeting.start_time < meeting.end_time <= 1440
    )


def _intersect(a: models.Meeting, b: models.Meeting) -> bool:
    return a.day == b.day and (
        max(a.start_time, b.start_time) < min(a.end_time, b.end_time)
    )


def validate_schedule(
    student: models.StudentProfile,
    candidates: list[models.Section],
    schedule: models.Schedule,
) -> list[str]:
    """Return sorted violation codes, or [] when all supported checks pass.

    Inputs are domain model objects, not arbitrary JSON. Invalid numeric and
    meeting values are reported as violations. No solver helpers are used.
    """
    errors: set[str] = set()
    by_id: dict[int, models.Section] = {}
    credits: dict[int, Decimal] = {}
    for section in candidates:
        number = section.class_num
        if type(number) is not int or number <= 0:
            errors.add("INVALID_SECTION_ID")
            continue
        if number in by_id:
            errors.add("DUPLICATE_CANDIDATE_ID")
        by_id[number] = section
        credit = _decimal(section.course.credits)
        if credit is None or credit < 0 or credit * 2 != (credit * 2).to_integral_value():
            errors.add("INVALID_COURSE_CREDITS")
        else:
            credits[number] = credit
        if any(not _valid_meeting(m) for m in section.meetings):
            errors.add("INVALID_MEETING")

    preferences = student.preferences
    lower = _decimal(preferences.credit_lower_bound)
    upper = _decimal(preferences.credit_upper_bound)
    if lower is None or upper is None or lower < 0 or upper < lower:
        errors.add("INVALID_CREDIT_BOUNDS")
    if any(not _valid_meeting(m) for m in preferences.unavailable):
        errors.add("INVALID_BLOCKED_TIME")

    # Reject malformed inputs before using them in arithmetic or comparisons.
    if errors:
        return sorted(errors)

    selected: list[models.Section] = []
    seen_sections: set[int] = set()
    seen_courses: set[models.CourseId] = set()
    for proposed in schedule.classes:
        if type(proposed.class_num) is not int or proposed.class_num not in by_id:
            errors.add("UNKNOWN_SECTION")
            continue
        section = by_id[proposed.class_num]
        if proposed != section:
            errors.add("SECTION_DATA_MISMATCH")
        if section.class_num in seen_sections:
            errors.add("DUPLICATE_SECTION")
        seen_sections.add(section.class_num)
        course = section.course
        if course.course_id in seen_courses:
            errors.add("DUPLICATE_COURSE")
        seen_courses.add(course.course_id)
        if course.course_id in student.classes_taken:
            errors.add("COMPLETED_COURSE_SELECTED")
        if not set(course.prereqs).issubset(student.classes_taken):
            errors.add("UNMET_PREREQUISITE")
        if any(_intersect(m, b) for m in section.meetings for b in preferences.unavailable):
            errors.add("BLOCKED_TIME_CONFLICT")
        selected.append(section)

    total = sum((credits[s.class_num] for s in selected), Decimal(0))
    if not lower <= total <= upper:
        errors.add("CREDIT_BOUNDS_VIOLATION")

    required = preferences.specific_courses - student.classes_taken
    if not required.issubset(seen_courses):
        errors.add("MISSING_REQUESTED_COURSE")

    for first, second in combinations(selected, 2):
        if any(_intersect(a, b) for a in first.meetings for b in second.meetings):
            errors.add("SECTION_TIME_CONFLICT")

    return sorted(errors)
