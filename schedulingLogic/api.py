from __future__ import annotations

import os

import psycopg
from fastapi import FastAPI
from pydantic import BaseModel
from pysat.examples.rc2 import RC2
from pysat.formula import WCNF

from candidate_builder import get_candidate_sections
from constraints_new import constraints_new
from input_builder import build_student_profile
from run_rc2 import decode_schedule, schedule_to_ui_sections
from wcnf import write_wcnf


app = FastAPI()


class GenerateScheduleRequest(BaseModel):
    parser_payload: dict
    ui_payload: dict
    term_season: str
    term_year: int


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
        return {
            "score": 0,
            "credits": 0,
            "sections": [],
        }

    hard, soft, _ = constraints_new(student, sections)
    write_wcnf("constraints_api.wcnf", hard, soft)

    wcnf = WCNF(from_file="constraints_api.wcnf")
    with RC2(wcnf) as rc2:
        model = rc2.compute()
        cost = rc2.cost

    schedule = decode_schedule(model, sections)
    return {
        "score": cost,
        "credits": schedule.credits,
        "sections": schedule_to_ui_sections(schedule),
    }
