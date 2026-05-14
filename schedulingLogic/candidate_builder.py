from __future__ import annotations

from collections import defaultdict
from datetime import time
from typing import Iterable

import models


DAY_MAP = {
    "monday": models.Day.MONDAY,
    "tuesday": models.Day.TUESDAY,
    "wednesday": models.Day.WEDNESDAY,
    "thursday": models.Day.THURSDAY,
    "friday": models.Day.FRIDAY,
    "saturday": models.Day.SATURDAY,
    "sunday": models.Day.SUNDAY,
    # Backward-compatible short names (older schema/seed variants).
    "mon": models.Day.MONDAY,
    "tue": models.Day.TUESDAY,
    "wed": models.Day.WEDNESDAY,
    "thu": models.Day.THURSDAY,
    "fri": models.Day.FRIDAY,
    "sat": models.Day.SATURDAY,
    "sun": models.Day.SUNDAY,
}


MODALITY_MAP = {
    "in_person": models.Modality.INPERSON,
    "hybrid": models.Modality.HYBRID,
    "asynchronous": models.Modality.ASYNCHRONOUS,
    "remote": models.Modality.REMOTE,
}


def parse_course_code(course_code: str) -> models.CourseId:
    """Converts a DB course_code like CSCI 13500 or CSCI_13500 into CourseId."""
    if "_" in course_code:
        subject, catalog = course_code.rsplit("_", 1)
    elif " " in course_code:
        subject, catalog = course_code.rsplit(" ", 1)
    else:
        raise ValueError(f"Unsupported course_code format: {course_code}")
    return models.CourseId(subject_area=subject, catalog_number=int(catalog))


def course_id_to_db(course_id: models.CourseId) -> str:
    """Converts CourseId into DB course_code format like CSCI_13500."""
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
    """Returns DB course_code strings that satisfy any requirement tag."""
    tags = [tag for tag in needed_tags if tag]
    if not tags:
        return set()

    sql = """
    SELECT DISTINCT c.course_code
    FROM courses c
    JOIN course_requirements_map crm ON crm.course_id = c.course_id
    JOIN course_requirements cr ON cr.req_id = crm.req_id
    WHERE cr.req_name = ANY(%s)
    """

    with conn.cursor() as cur:
        cur.execute(sql, (tags,))
        return {row[0] for row in cur.fetchall()}


def fetch_fulfills_by_course_codes(conn, db_course_codes: Iterable[str]) -> dict[str, list[str]]:
    """Returns requirement tag names for each DB course_code."""
    course_codes = [cc for cc in db_course_codes if cc]
    if not course_codes:
        return {}

    sql = """
    SELECT c.course_code, cr.req_name
    FROM course_requirements_map crm
    JOIN courses c ON c.course_id = crm.course_id
    JOIN course_requirements cr ON cr.req_id = crm.req_id
    WHERE c.course_code = ANY(%s)
    ORDER BY c.course_code, cr.req_name
    """

    out: dict[str, list[str]] = defaultdict(list)
    with conn.cursor() as cur:
        cur.execute(sql, (course_codes,))
        for course_code, req_name in cur.fetchall():
            out[course_code].append(req_name)

    return dict(out)


def _query_sections_with_meetings(
    conn,
    db_course_codes: set[str],
    term_season: str,
    term_year: int,
    include_waitlist: bool = True,
) -> list[dict]:
    if not db_course_codes:
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
    WITH target(course_code) AS (
      SELECT unnest(%s::text[])
    )
    SELECT
      s.class_num,
      s.section_number AS section_code,
      s.instruction_mode,
      s.enrollment AS enrolled,
      s.max_enrollment AS capacity,
      s.instructor,
      c.course_id,
      c.course_code,
      c.dep_code,
      d.dep_name AS department_name,
      c.course_name AS title,
      c.course_description AS description,
      c.credits,
      c.prerequisites,
      sm.day_of_week,
      sm.start_time,
      sm.end_time
    FROM sections s
    JOIN courses c ON c.course_id = s.course_id
    JOIN departments d ON d.dep_code = c.dep_code
    {join_clause}
    JOIN target t ON t.course_code = c.course_code
    WHERE s.term_season = %s
      AND s.term_year = %s
      AND (
        s.enrollment_status = ANY(%s)
        OR s.enrollment_status IS NULL
      )
    ORDER BY s.class_num, sm.day_of_week, sm.start_time
    """

    with conn.cursor() as cur:
        cur.execute(sql, (list(db_course_codes), term_season.upper(), term_year, statuses))
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, row)) for row in cur.fetchall()]


def _row_to_course(row: dict, tags: list[str] | set[str]) -> models.Course:
    course_id = parse_course_code(row["course_code"])

    # TODO(DB-Mismatch): `courses` table has no academic career value.
    # This is currently defaulted to UNDERGRADUATE.
    prereqs: list[models.CourseId] = []
    for raw in row.get("prerequisites") or []:
        try:
            prereqs.append(parse_course_code(raw))
        except Exception:
            # TODO(DB-Mismatch): log/monitor malformed prerequisite strings from DB.
            continue

    return models.Course(
        course_id=course_id,
        course_title=row["title"],
        department=row.get("department_name") or row.get("dep_code") or "",
        academic_career=models.AcademicCareer.UNDERGRADUATE,
        credits=float(row["credits"]),
        description=row.get("description") or "",
        tags=set(tags),
        prereqs=prereqs,
    )


def _row_to_meetings(row: dict) -> list[models.Meeting]:
    day_values = row["day_of_week"]
    if isinstance(day_values, str):
        # Handle Postgres text array format, e.g. "{Tuesday,Thursday}".
        raw = day_values.strip()
        if raw.startswith("{") and raw.endswith("}"):
            inner = raw[1:-1].strip()
            day_values = [d.strip() for d in inner.split(",") if d.strip()] if inner else []
        else:
            day_values = [raw]

    meetings: list[models.Meeting] = []
    for raw_day in day_values:
        day_key = str(raw_day).lower()
        meetings.append(
            models.Meeting(
                day=DAY_MAP[day_key],
                start_time=time_to_minutes(row["start_time"]),
                end_time=time_to_minutes(row["end_time"]),
            )
        )
    return meetings


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

    # Consolidate duplicate courses across requirements and aggregate all
    # requirement names as course tags.
    target_course_ids: set[models.CourseId] = set()
    tags_by_course: dict[models.CourseId, set[str]] = defaultdict(set)

    for requirement in student_profile.requirements_needed:
        req_tag = (getattr(requirement, "name", "") or "").strip()
        for cid in requirement.fulfilled_by:
            if cid in taken_ids:
                continue
            target_course_ids.add(cid)
            if req_tag:
                tags_by_course[cid].add(req_tag)

    requested_db_ids: set[str] = set()
    for course_id in requested_courses:
        if course_id in taken_ids:
            continue
        target_course_ids.add(course_id)
        requested_db_ids.update(course_id_to_db_ids(course_id))

    needed_db_codes: set[str] = set()
    for course_id in target_course_ids:
        needed_db_codes.update(course_id_to_db_ids(course_id))

    target_db_codes = needed_db_codes | requested_db_ids

    # TEMP DEBUG: remove once candidate flow is validated on real data.
    print("[candidate_builder] term:", term_season, term_year)
    print("[candidate_builder] requirements_needed:", len(student_profile.requirements_needed))
    print("[candidate_builder] classes_taken:", len(student_profile.classes_taken))
    print("[candidate_builder] target_course_ids:", len(target_course_ids))
    print("[candidate_builder] needed_db_codes:", len(needed_db_codes))
    if needed_db_codes:
        print("[candidate_builder] needed_db_codes sample:", sorted(list(needed_db_codes))[:8])
    print("[candidate_builder] requested_db_ids:", len(requested_db_ids))
    print("[candidate_builder] target_db_codes:", len(target_db_codes))
    if target_db_codes:
        print("[candidate_builder] target_db_codes sample:", sorted(list(target_db_codes))[:8])

    rows = _query_sections_with_meetings(
        conn=conn,
        db_course_codes=target_db_codes,
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
        meetings_by_section[class_num].extend(_row_to_meetings(row))

    sections: list[models.Section] = []
    for class_num, row in grouped_rows.items():
        mode_raw = row["instruction_mode"]
        if isinstance(mode_raw, str):
            mode_raw = mode_raw.lower()

        # TODO(DB-Mismatch): If DB introduces new modality values, this will fail.
        # Keep this strict so schema drift is visible early.
        cid = parse_course_code(row["course_code"])
        fulfills = tags_by_course.get(cid, set())
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
