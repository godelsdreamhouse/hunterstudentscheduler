from __future__ import annotations

from collections import defaultdict
from datetime import time
from typing import Iterable

import models


DAY_MAP = {
    "mon": models.Day.MONDAY,
    "tue": models.Day.TUESDAY,
    "wed": models.Day.WEDNESDAY,
    "thu": models.Day.THURSDAY,
    "fri": models.Day.FRIDAY,
    "sat": models.Day.SATURDAY,
    "sun": models.Day.SUNDAY,
}

# DB modality enum currently includes:
# in_person, hybrid, asynchronous, remote
MODALITY_MAP = {
    "in_person": models.Modality.INPERSON,
    "hybrid": models.Modality.HYBRID,
    "asynchronous": models.Modality.ASYNCHRONOUS,
    "remote": models.Modality.REMOTE,
}


def parse_course_id(course_id: str) -> models.CourseId:
    """Converts a DB course_id like CSCI_13500 or CSCI 13500 into CourseId."""
    # TODO(DB-Mismatch): this currently accepts underscore or single-space delimiters.
    # Confirm final canonical DB `course_id` format and simplify this parser after alignment.
    if "_" in course_id:
        subject, catalog = course_id.rsplit("_", 1)
    elif " " in course_id:
        subject, catalog = course_id.rsplit(" ", 1)
    else:
        raise ValueError(f"Unsupported course_id format: {course_id}")
    return models.CourseId(subject_area=subject, catalog_number=int(catalog))


def course_id_to_db(course_id: models.CourseId) -> str:
    """Converts CourseId into DB format like CSCI_13500."""
    return f"{course_id.subject_area}_{course_id.catalog_number}"


def course_to_db_ids(course: models.Course) -> set[str]:
    """Returns possible DB course_id formats for a Course object."""
    return course_id_to_db_ids(course.course_id)


def course_id_to_db_ids(course_id: models.CourseId) -> set[str]:
    subject = course_id.subject_area
    catalog = course_id.catalog_number
    return {f"{subject}_{catalog}", f"{subject} {catalog}"}


def time_to_minutes(t: time) -> int:
    return t.hour * 60 + t.minute


def fetch_course_ids_for_tags(conn, needed_tags: Iterable[str]) -> set[str]:
    """Returns DB course_id strings that satisfy any requirement tag."""
    tags = [tag for tag in needed_tags if tag]
    if not tags:
        return set()

    sql = """
    SELECT DISTINCT c.course_id
    FROM courses c
    JOIN course_requirements_map crm ON crm.course_id = c.course_id
    JOIN course_requirements cr ON cr.req_id = crm.req_id
    WHERE cr.req_name = ANY(%s)
    """

    with conn.cursor() as cur:
        cur.execute(sql, (tags,))
        return {row[0] for row in cur.fetchall()}


def fetch_fulfills_by_course_ids(conn, db_course_ids: Iterable[str]) -> dict[str, list[str]]:
    """Returns requirement tag names for each DB course_id."""
    course_ids = [cid for cid in db_course_ids if cid]
    if not course_ids:
        return {}

    sql = """
    SELECT crm.course_id, cr.req_name
    FROM course_requirements_map crm
    JOIN course_requirements cr ON cr.req_id = crm.req_id
    WHERE crm.course_id = ANY(%s)
    ORDER BY crm.course_id, cr.req_name
    """

    out: dict[str, list[str]] = defaultdict(list)
    with conn.cursor() as cur:
        cur.execute(sql, (course_ids,))
        for course_id, req_name in cur.fetchall():
            out[course_id].append(req_name)

    return dict(out)


def _query_sections_with_meetings(
    conn,
    db_course_ids: set[str],
    term_season: str,
    term_year: int,
    include_waitlist: bool = True,
) -> list[dict]:
    if not db_course_ids:
        return []

    statuses = ["open", "waitlist"] if include_waitlist else ["open"]

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_name = 'section_meetings' AND column_name = 'class_num'
            LIMIT 1
            """
        )
        has_sm_class_num = cur.fetchone() is not None

    join_clause = (
        "JOIN section_meetings sm ON sm.class_num = s.class_num"
        if has_sm_class_num
        else "JOIN section_meetings sm ON sm.section_id = s.section_id"
    )

    sql = f"""
    WITH target(course_id) AS (
      SELECT unnest(%s::text[])
    )
    SELECT
      s.class_num,
      s.section_code,
      s.instruction_mode,
      s.enrolled,
      s.capacity,
      s.instructor,
      c.course_id,
      c.dep_code,
      d.name AS department_name,
      c.title,
      c.description,
      c.credits,
      sm.day_of_week,
      sm.start_time,
      sm.end_time
    FROM sections s
    JOIN courses c ON c.course_id = s.course_id
    JOIN departments d ON d.dep_code = c.dep_code
    {join_clause}
    JOIN target t ON t.course_id = s.course_id
    WHERE s.term_season = %s
      AND s.term_year = %s
      AND s.enrollment_status = ANY(%s)
    ORDER BY s.class_num, sm.day_of_week, sm.start_time
    """

    with conn.cursor() as cur:
        cur.execute(sql, (list(db_course_ids), term_season.upper(), term_year, statuses))
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def _row_to_course(row: dict, fulfills: list[str]) -> models.Course:
    course_id = parse_course_id(row["course_id"])

    # TODO(DB-Mismatch): `courses` table has no academic career value.
    # This is currently defaulted to UNDERGRADUATE.
    # Confirm whether career should come from another table/source.
    #
    # TODO(DB-Mismatch): `models.Course.credits` is int, but DB `credits` is NUMERIC(3,1).
    # Current conversion truncates decimal credits (e.g., 3.5 -> 3).
    #
    prereq_raw = row.get("prerequisites") or []
    coreq_raw = row.get("corequisites") or []
    prereqs: list[tuple[str, int]] = []
    coreqs: list[tuple[str, int]] = []

    for p in prereq_raw:
        try:
            pid = parse_course_id(p)
            prereqs.append((pid.subject_area, pid.catalog_number))
        except Exception:
            continue

    for c in coreq_raw:
        try:
            cid = parse_course_id(c)
            coreqs.append((cid.subject_area, cid.catalog_number))
        except Exception:
            continue

    return models.Course(
        course_id=course_id,
        course_title=row["title"],
        departments=[row.get("department_name") or row.get("dep_code")],
        academic_career=models.AcademicCareer.UNDERGRADUATE,
        credits=int(row["credits"]),
        description=row.get("description") or "",
        fulfills=fulfills,
        prereqs=prereqs,
        coreqs=coreqs,
    )


def _row_to_meeting(row: dict) -> models.Meeting:
    day_key = row["day_of_week"]
    if isinstance(day_key, str):
        day_key = day_key.lower()

    return models.Meeting(
        day=DAY_MAP[day_key],
        start_time=time_to_minutes(row["start_time"]),
        end_time=time_to_minutes(row["end_time"]),
    )


def get_candidate_sections(
    conn,
    student_profile: models.StudentProfile,
    term_season: str,
    term_year: int,
    requested_courses: Iterable[models.CourseId] = (),
    include_waitlist: bool = True,
) -> list[models.Section]:
    """
    Builds solver candidates from:
    - student_profile.requirements_needed[*].fulfilled_by courses
    - user-requested courses (requested_courses)
    """
    taken_ids = set(student_profile.classes_taken)

    needed_db_ids: set[str] = set()
    needed_tags: set[str] = set()
    for requirement in student_profile.requirements_needed:
        if requirement.fulfilled_by:
            for course in requirement.fulfilled_by:
                if course.course_id in taken_ids:
                    continue
                needed_db_ids.update(course_to_db_ids(course))
        elif getattr(requirement, "attribute", None):
            needed_tags.add(requirement.attribute)

    requested_db_ids: set[str] = set()
    for course_id in requested_courses:
        if course_id in taken_ids:
            continue
        requested_db_ids.update(course_id_to_db_ids(course_id))
    tag_db_ids = fetch_course_ids_for_tags(conn, needed_tags)

    filtered_tag_db_ids: set[str] = set()
    for raw_id in tag_db_ids:
        if parse_course_id(raw_id) in taken_ids:
            continue
        filtered_tag_db_ids.add(raw_id)

    target_db_ids = needed_db_ids | requested_db_ids | filtered_tag_db_ids

    # TEMP DEBUG: remove once candidate flow is validated on real data.
    print("[candidate_builder] term:", term_season, term_year)
    print("[candidate_builder] requirements_needed:", len(student_profile.requirements_needed))
    print("[candidate_builder] classes_taken:", len(student_profile.classes_taken))
    print("[candidate_builder] needed_db_ids:", len(needed_db_ids))
    if needed_db_ids:
        print("[candidate_builder] needed_db_ids sample:", sorted(list(needed_db_ids))[:8])
    print("[candidate_builder] needed_tags:", len(needed_tags))
    if needed_tags:
        print("[candidate_builder] needed_tags sample:", sorted(list(needed_tags))[:8])
    print("[candidate_builder] tag_db_ids:", len(tag_db_ids))
    if tag_db_ids:
        print("[candidate_builder] tag_db_ids sample:", sorted(list(tag_db_ids))[:8])
    print("[candidate_builder] requested_db_ids:", len(requested_db_ids))
    print("[candidate_builder] target_db_ids:", len(target_db_ids))
    if target_db_ids:
        print("[candidate_builder] target_db_ids sample:", sorted(list(target_db_ids))[:8])

    fulfills_by_course = fetch_fulfills_by_course_ids(conn, target_db_ids)

    rows = _query_sections_with_meetings(
        conn=conn,
        db_course_ids=target_db_ids,
        term_season=term_season,
        term_year=term_year,
        include_waitlist=include_waitlist,
    )

    if not rows:
        return []

    grouped_rows: dict[int, dict] = {}
    meetings_by_section: dict[int, list[models.Meeting]] = defaultdict(list)

    for row in rows:
        class_num = int(row["class_num"])
        if class_num not in grouped_rows:
            grouped_rows[class_num] = row
        meetings_by_section[class_num].append(_row_to_meeting(row))

    sections: list[models.Section] = []
    for class_num, row in grouped_rows.items():
        mode_raw = row["instruction_mode"]
        if isinstance(mode_raw, str):
            mode_raw = mode_raw.lower()

        # TODO(DB-Mismatch): If DB introduces new modality values, this will fail.
        # Keep this strict so schema drift is visible early.
        fulfills = fulfills_by_course.get(row["course_id"], [])
        section = models.Section(
            course=_row_to_course(row, fulfills),
            section_code=row["section_code"],
            class_num=class_num,
            instruction_modality=MODALITY_MAP[mode_raw],
            enrollement_total=int(row.get("enrolled") or 0),
            class_capacity=int(row.get("capacity") or 0),
            meetings=meetings_by_section[class_num],
            instructor=row.get("instructor") or "",
        )
        sections.append(section)

    return sections
