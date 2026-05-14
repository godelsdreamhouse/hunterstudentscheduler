from __future__ import annotations

import os

import psycopg
from fastapi import FastAPI
from pydantic import BaseModel
from pysat.examples.rc2 import RC2
from pysat.formula import WCNF

from candidate_builder import get_candidate_sections
from constraints_new import constraints_new, during_blocked_time, prereq_met
from input_builder import build_student_profile
import models
from run_rc2 import decode_schedule, schedule_to_ui_sections
from wcnf import write_wcnf


app = FastAPI()


class GenerateScheduleRequest(BaseModel):
    parser_payload: dict
    ui_payload: dict
    term_season: str
    term_year: int


def _build_error_payload(
    code: str,
    message: str,
    details: dict | None = None,
) -> dict:
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


def _infer_empty_schedule_reason(
    student: models.StudentProfile,
    sections: list[models.Section],
) -> tuple[str, str, dict]:
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
) -> tuple[list[str], dict]:
    codes: list[str] = []
    details: dict = {"score": score}
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
def generate_schedule(req: GenerateScheduleRequest) -> dict:
    student = build_student_profile(req.parser_payload, req.ui_payload)

    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        sections = get_candidate_sections(
            conn=conn,
            student_profile=student,
            term_season=req.term_season,
            term_year=req.term_year,
        )

    if not sections:
        code, message, details = _infer_empty_schedule_reason(student, sections)
        return _build_error_payload(code, message, details)

    hard, soft, _ = constraints_new(student, sections)
    write_wcnf("constraints_api.wcnf", hard, soft)

    wcnf = WCNF(from_file="constraints_api.wcnf")
    with RC2(wcnf) as rc2:
        model = rc2.compute()
        cost = rc2.cost

    schedule = decode_schedule(model, sections)
    if not schedule.classes:
        code, message, details = _infer_empty_schedule_reason(student, sections)
        return _build_error_payload(code, message, details)

    optimization_codes, optimization_details = _build_optimization_payload(
        student=student,
        schedule=schedule,
        score=cost,
    )

    return {
        "score": cost,
        "credits": schedule.credits,
        "sections": schedule_to_ui_sections(schedule),
        "error_code": None,
        "error_message": None,
        "error_details": {},
        "optimization_codes": optimization_codes,
        "optimization_details": optimization_details,
    }
