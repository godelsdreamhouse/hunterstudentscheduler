from __future__ import annotations

import logging
import os
import tempfile
from typing import Any

import psycopg
from fastapi import FastAPI
from pydantic import BaseModel
from pysat.examples.rc2 import RC2
from pysat.formula import WCNF

from candidate_builder import get_candidate_sections
from constraints_new import constraints_new
from errors import (
    DATABASE_CONNECTION_FAILED,
    ERROR_MESSAGES,
    INVALID_PAYLOAD,
    NO_CANDIDATES_FOUND,
    SOLVER_FAILED,
    UNSATISFIABLE_CONSTRAINTS,
    SchedulerErrorCode,
)
from input_builder import build_student_profile
from run_rc2 import decode_schedule, schedule_to_ui_sections
from wcnf import write_wcnf


app = FastAPI()
logger = logging.getLogger(__name__)


class GenerateScheduleRequest(BaseModel):
    parser_payload: dict
    ui_payload: dict
    term_season: str
    term_year: int


def _schedule_response(
    *,
    score: int | float = 0,
    credits: int | float = 0,
    sections: list[dict] | None = None,
    error: dict[str, Any] | None = None,
) -> dict:
    # Keep the API's established schedule payload keys present even on failures.
    response: dict[str, Any] = {
        "score": score,
        "credits": credits,
        "sections": sections or [],
    }
    if error is not None:
        response["error"] = error
    return response


def _error(code: SchedulerErrorCode, message: str | None = None) -> dict[str, str]:
    return {"code": code, "message": message or ERROR_MESSAGES[code]}


@app.post("/api/schedule/generate")
def generate_schedule(req: GenerateScheduleRequest) -> dict:
    try:
        student = build_student_profile(req.parser_payload, req.ui_payload)
    except (KeyError, TypeError, ValueError):
        logger.exception("Invalid schedule generation payload")
        return _schedule_response(
            error=_error(
                INVALID_PAYLOAD,
                "Schedule generation request payload is invalid.",
            )
        )

    requested_courses = student.major_electives | student.general_electives

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        logger.error("DATABASE_URL is not configured")
        return _schedule_response(
            error=_error(
                DATABASE_CONNECTION_FAILED,
                "Schedule generation is temporarily unavailable.",
            )
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
        return _schedule_response(
            error=_error(
                DATABASE_CONNECTION_FAILED,
                "Schedule generation is temporarily unavailable.",
            )
        )

    if not sections:
        return _schedule_response(
            error=_error(
                NO_CANDIDATES_FOUND,
                "No eligible sections were found for the requested term.",
            )
        )

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
                model = rc2.compute()
                cost = rc2.cost
        finally:
            try:
                os.unlink(wcnf_path)
            except OSError:
                logger.warning("Failed to remove temporary WCNF file: %s", wcnf_path)
    except Exception:
        logger.exception("Solver failed while generating schedule")
        return _schedule_response(
            error=_error(
                SOLVER_FAILED,
                "Schedule generation failed while evaluating constraints.",
            )
        )

    if model is None:
        logger.info("Solver returned no satisfiable schedule")
        return _schedule_response(
            error=_error(
                UNSATISFIABLE_CONSTRAINTS,
                "No schedule satisfies the requested constraints.",
            )
        )

    try:
        schedule = decode_schedule(model, sections)
        ui_sections = schedule_to_ui_sections(schedule)
    except Exception:
        logger.exception("Failed to decode solver model")
        return _schedule_response(
            error=_error(
                SOLVER_FAILED,
                "Schedule generation failed while decoding solver output.",
            )
        )

    return _schedule_response(score=cost, credits=schedule.credits, sections=ui_sections)
