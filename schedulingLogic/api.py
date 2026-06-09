from __future__ import annotations

import logging
import os
import tempfile
from threading import Timer
from typing import Any

import models
import psycopg
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pysat.examples.rc2 import RC2
from pysat.formula import WCNF

from candidate_builder import get_candidate_sections
from constraints_new import constraints_new, during_blocked_time, prereq_met
from input_builder import build_student_profile
from run_rc2 import decode_schedule, schedule_to_ui_sections
from wcnf import write_wcnf


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost:\d+|.+\.vercel\.app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger = logging.getLogger(__name__)

DEFAULT_SOLVER_TIMEOUT_SECONDS = 20


class GenerateScheduleRequest(BaseModel):
    parser_payload: dict
    ui_payload: dict
    term_season: str
    term_year: int


def _build_error_payload(
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "score": 0,
        "credits": 0,
        "sections": [],
        "error_code": code,
        "error_message": message,
        "error_details": details or {},
        "optimization_codes": [],
        "optimization_details": {},
    }


def _build_success_payload(
    *,
    score: int,
    schedule: models.Schedule,
    optimization_codes: list[str],
    optimization_details: dict[str, Any],
) -> dict[str, Any]:
    return {
        "score": score,
        "credits": schedule.credits,
        "sections": schedule_to_ui_sections(schedule),
        "error_code": None,
        "error_message": None,
        "error_details": {},
        "optimization_codes": optimization_codes,
        "optimization_details": optimization_details,
    }


def _course_id_payload(course_id: models.CourseId) -> dict[str, Any]:
    return {
        "subject_area": course_id.subject_area,
        "catalog_number": course_id.catalog_number,
    }


def _filter_candidate_sections(
    student: models.StudentProfile,
    sections: list[models.Section],
) -> list[models.Section]:
    """Remove sections that can never be selected before building SAT clauses."""
    return [
        section
        for section in sections
        if section.course.course_id not in student.classes_taken
        and prereq_met(section, student)
        and not during_blocked_time(student, section)
        and (
            not student.preferences.open_seats
            or section.enrollement_total < section.class_capacity
        )
    ]


def _schedule_diagnostics(
    *,
    student: models.StudentProfile,
    sections: list[models.Section],
    hard: list[list[int]] | None = None,
    soft: list[tuple[int, list[int]]] | None = None,
    term_season: str,
    term_year: int,
) -> dict[str, Any]:
    details: dict[str, Any] = {
        "term_season": term_season,
        "term_year": term_year,
        "candidate_sections": len(sections),
        "candidate_courses": len({section.course.course_id for section in sections}),
        "requirements_needed": len(student.requirements_needed),
        "classes_taken": len(student.classes_taken),
        "specific_courses": [
            _course_id_payload(course_id)
            for course_id in sorted(
                student.preferences.specific_courses,
                key=lambda c: (c.subject_area, c.catalog_number),
            )
        ],
        "specific_courses_count": len(student.preferences.specific_courses),
        "unavailable_blocks": len(student.preferences.unavailable),
    }

    if hard is not None:
        details["hard_clauses"] = len(hard)
    if soft is not None:
        details["soft_clauses"] = len(soft)

    return details


def _specific_course_unavailable_reason(
    student: models.StudentProfile,
    course_id: models.CourseId,
    course_sections: list[models.Section],
) -> tuple[str, str]:
    if not course_sections:
        return (
            "NO_SECTIONS_FOR_TERM",
            "No sections were found for this specific course in the requested term.",
        )

    prereq_ok = [s for s in course_sections if prereq_met(s, student)]
    if not prereq_ok:
        return (
            "PREREQUISITES_NOT_MET",
            "The student does not meet prerequisites for any section of this specific course.",
        )

    unblocked = [s for s in prereq_ok if not during_blocked_time(student, s)]
    if not unblocked:
        return (
            "ALL_SECTIONS_IN_BLOCKED_TIME",
            "Every prerequisite-eligible section conflicts with unavailable times.",
        )

    return (
        "NO_ELIGIBLE_SECTIONS",
        "No eligible sections were found for this specific course.",
    )


def _find_unavailable_specific_courses(
    student: models.StudentProfile,
    sections: list[models.Section],
) -> list[dict[str, Any]]:
    unavailable = []
    needed_specific_courses = student.preferences.specific_courses - student.classes_taken

    for course_id in sorted(
        needed_specific_courses,
        key=lambda c: (c.subject_area, c.catalog_number),
    ):
        course_sections = [
            section for section in sections if section.course.course_id == course_id
        ]
        eligible_sections = [
            section
            for section in course_sections
            if prereq_met(section, student)
            and not during_blocked_time(student, section)
        ]

        if eligible_sections:
            continue

        reason_code, reason_message = _specific_course_unavailable_reason(
            student,
            course_id,
            course_sections,
        )
        unavailable.append(
            {
                "course": _course_id_payload(course_id),
                "reason_code": reason_code,
                "reason_message": reason_message,
                "candidate_sections": len(course_sections),
                "prereq_eligible_sections": sum(
                    1 for section in course_sections if prereq_met(section, student)
                ),
            }
        )

    return unavailable


def _solver_timeout_seconds() -> float:
    raw_value = os.environ.get("SCHEDULER_SOLVER_TIMEOUT_SECONDS")
    if raw_value is None:
        return DEFAULT_SOLVER_TIMEOUT_SECONDS

    try:
        timeout = float(raw_value)
    except ValueError:
        logger.warning(
            "Invalid SCHEDULER_SOLVER_TIMEOUT_SECONDS value: %s",
            raw_value,
        )
        return DEFAULT_SOLVER_TIMEOUT_SECONDS

    return max(timeout, 0.1)


def _compute_rc2_with_timeout(rc2: RC2, timeout_seconds: float) -> list[int] | None:
    timer = Timer(timeout_seconds, rc2.interrupt)
    timer.daemon = True
    timer.start()
    try:
        return rc2.compute(expect_interrupt=True)
    finally:
        timer.cancel()


def _infer_empty_schedule_reason(
    student: models.StudentProfile,
    sections: list[models.Section],
) -> tuple[str, str, dict[str, Any]]:
    if not sections:
        return (
            "NO_CANDIDATE_SECTIONS",
            "No candidate sections matched the requested requirements/term.",
            {
                "requirements_count": len(student.requirements_needed),
                "classes_taken_count": len(student.classes_taken),
            },
        )

    prereq_ok = [s for s in sections if prereq_met(s, student)]
    blocked = [s for s in sections if during_blocked_time(student, s)]
    available_after_block = [s for s in prereq_ok if not during_blocked_time(student, s)]

    if not prereq_ok:
        return (
            "ALL_CANDIDATES_FAIL_PREREQS",
            "All candidate sections were filtered out because prerequisites were not met.",
            {"candidate_count": len(sections)},
        )

    if prereq_ok and len(blocked) == len(prereq_ok):
        return (
            "ALL_CANDIDATES_IN_BLOCKED_TIME",
            "All prerequisite-eligible sections conflicted with blocked/unavailable times.",
            {
                "candidate_count": len(sections),
                "prereq_eligible_count": len(prereq_ok),
            },
        )

    if not available_after_block:
        return (
            "NO_ELIGIBLE_CANDIDATES",
            "No candidate sections remained after prerequisite and blocked-time checks.",
            {"candidate_count": len(sections)},
        )

    return (
        "UNSAT_HARD_CONSTRAINTS",
        "No schedule satisfied all hard constraints for the current candidate set.",
        {
            "candidate_count": len(sections),
            "prereq_eligible_count": len(prereq_ok),
            "unblocked_eligible_count": len(available_after_block),
        },
    )


def _build_optimization_payload(
    student: models.StudentProfile,
    schedule: models.Schedule,
    score: int,
) -> tuple[list[str], dict[str, Any]]:
    codes: list[str] = []
    details: dict[str, Any] = {"score": score}
    sections = schedule.classes

    if not sections:
        return codes, details

    if student.preferences.morning:
        codes.append("PREF_MORNING_ACTIVE")
        details["morning_sections"] = sum(
            1 for s in sections if s.time_category() == models.TimeOfDay.MORNING
        )
    if student.preferences.afternoon:
        codes.append("PREF_AFTERNOON_ACTIVE")
        details["afternoon_sections"] = sum(
            1 for s in sections if s.time_category() == models.TimeOfDay.AFTERNOON
        )
    if student.preferences.evening:
        codes.append("PREF_EVENING_ACTIVE")
        details["evening_sections"] = sum(
            1 for s in sections if s.time_category() == models.TimeOfDay.EVENING
        )
    if student.preferences.in_person:
        codes.append("PREF_INPERSON_ACTIVE")
        details["inperson_sections"] = sum(
            1 for s in sections if s.instruction_modality == models.Modality.INPERSON
        )
    if student.preferences.remote:
        codes.append("PREF_REMOTE_ACTIVE")
        details["remote_sections"] = sum(
            1 for s in sections if s.instruction_modality == models.Modality.REMOTE
        )
    if student.preferences.less_days:
        codes.append("OPT_MINIMIZE_DAYS_ACTIVE")
        details["distinct_days"] = len({m.day for s in sections for m in s.meetings})
    if student.preferences.less_gaps:
        codes.append("OPT_MINIMIZE_GAPS_ACTIVE")

    if any(len(s.course.tags) > 1 for s in sections):
        codes.append("OPT_MULTI_REQUIREMENT_TAG_PRIORITY")

    codes.append("MAXSAT_RC2_OPTIMIZED")
    return codes, details


@app.post("/api/schedule/generate")
def generate_schedule(req: GenerateScheduleRequest) -> dict[str, Any]:
    try:
        student = build_student_profile(req.parser_payload, req.ui_payload)
    except (KeyError, TypeError, ValueError):
        logger.exception("Invalid schedule generation payload")
        return _build_error_payload(
            "INVALID_PAYLOAD",
            "Schedule generation request payload is invalid.",
        )

    requested_courses = (
        student.major_electives
        | student.general_electives
        | student.preferences.specific_courses
    )
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        logger.error("DATABASE_URL is not configured")
        return _build_error_payload(
            "DATABASE_CONNECTION_FAILED",
            "Schedule generation is temporarily unavailable.",
        )

    try:
        with psycopg.connect(database_url) as conn:
            sections = get_candidate_sections(
                conn=conn,
                student_profile=student,
                term_season=req.term_season,
                term_year=req.term_year,
                requested_courses=requested_courses,
            )
    except psycopg.Error:
        logger.exception("Failed to load candidate sections from the database")
        return _build_error_payload(
            "DATABASE_CONNECTION_FAILED",
            "Schedule generation is temporarily unavailable.",
        )

    unavailable_specific_courses = _find_unavailable_specific_courses(student, sections)
    if unavailable_specific_courses:
        return _build_error_payload(
            "SPECIFIC_COURSE_NO_ELIGIBLE_SECTIONS",
            "One or more requested specific courses have no eligible sections.",
            {
                "specific_courses": unavailable_specific_courses,
                "term_season": req.term_season,
                "term_year": req.term_year,
            },
        )

    unfiltered_sections = sections
    sections = _filter_candidate_sections(student, sections)

    if not sections:
        code, message, details = _infer_empty_schedule_reason(student, unfiltered_sections)
        return _build_error_payload(code, message, details)

    try:
        hard, soft, _ = constraints_new(student, sections)
        with tempfile.NamedTemporaryFile(
            mode="w",
            prefix="constraints_api_",
            suffix=".wcnf",
            delete=False,
        ) as tmp:
            wcnf_path = tmp.name
        try:
            write_wcnf(wcnf_path, hard, soft)
            wcnf = WCNF(from_file=wcnf_path)
            with RC2(wcnf) as rc2:
                timeout_seconds = _solver_timeout_seconds()
                model = _compute_rc2_with_timeout(rc2, timeout_seconds)
                if getattr(rc2, "interrupted", False):
                    details = _schedule_diagnostics(
                        student=student,
                        sections=sections,
                        hard=hard,
                        soft=soft,
                        term_season=req.term_season,
                        term_year=req.term_year,
                    )
                    details["timeout_seconds"] = timeout_seconds
                    logger.warning("Solver timed out: %s", details)
                    return _build_error_payload(
                        "SOLVER_TIMEOUT",
                        "Schedule generation timed out while evaluating constraints.",
                        details,
                    )
                cost = rc2.cost
        finally:
            try:
                os.unlink(wcnf_path)
            except OSError:
                logger.warning("Failed to remove temporary WCNF file: %s", wcnf_path)
    except Exception:
        logger.exception("Solver failed while generating schedule")
        return _build_error_payload(
            "SOLVER_FAILED",
            "Schedule generation failed while evaluating constraints.",
        )

    if model is None:
        logger.info("Solver returned no satisfiable schedule")
        code, message, details = _infer_empty_schedule_reason(student, sections)
        return _build_error_payload(code, message, details)

    try:
        schedule = decode_schedule(model, sections)
    except Exception:
        logger.exception("Failed to decode solver model")
        return _build_error_payload(
            "SOLVER_FAILED",
            "Schedule generation failed while decoding solver output.",
        )

    if not schedule.classes:
        code, message, details = _infer_empty_schedule_reason(student, sections)
        return _build_error_payload(code, message, details)

    optimization_codes, optimization_details = _build_optimization_payload(
        student=student,
        schedule=schedule,
        score=cost,
    )
    return _build_success_payload(
        score=cost,
        schedule=schedule,
        optimization_codes=optimization_codes,
        optimization_details=optimization_details,
    )
