from __future__ import annotations

import argparse
import os
import sys
from collections.abc import Sequence
from pathlib import Path


SCHEDULER_DIR = Path(__file__).resolve().parents[1]
if str(SCHEDULER_DIR) not in sys.path:
    sys.path.insert(0, str(SCHEDULER_DIR))

SUPABASE_HOST = "aws-1-us-east-2.pooler.supabase.com"
SUPABASE_USER = "postgres.wwxkdnvlksbmpddhooae"

EXIT_SUCCESS = 0
EXIT_FAILURE = 1


def database_url_from_env() -> str:
    if os.environ.get("DATABASE_URL"):
        return os.environ["DATABASE_URL"]

    password = os.environ.get("DB_PASSWORD")
    if not password:
        raise RuntimeError("Set DB_PASSWORD or DATABASE_URL before running this script.")

    return (
        f"host={SUPABASE_HOST} "
        "port=5432 "
        "dbname=postgres "
        f"user={SUPABASE_USER} "
        f"password={password} "
        "sslmode=require"
    )


def solve_schedule(
    hard: list[list[int]], soft: list[tuple[int, list[int]]]
) -> tuple[list[int] | None, int]:
    from pysat.examples.rc2 import RC2
    from pysat.formula import WCNF

    wcnf = WCNF()
    for clause in hard:
        wcnf.append(clause)
    for weight, clause in soft:
        wcnf.append(clause, weight=weight)

    with RC2(wcnf) as rc2:
        model = rc2.compute()
        return model, rc2.cost


def print_candidate_sections(sections) -> None:
    print("candidate section details:")
    for section in sections:
        cid = section.course.course_id
        meetings = ", ".join(
            f"{m.day.value} {m.start_time // 60:02d}:{m.start_time % 60:02d}-"
            f"{m.end_time // 60:02d}:{m.end_time % 60:02d}"
            for m in section.meetings
        )
        print(
            f"- {cid.subject_area} {cid.catalog_number} "
            f"section {section.section_code} "
            f"class {section.class_num} "
            f"credits {section.course.credits} "
            f"tags {sorted(section.course.tags)} "
            f"mode {section.instruction_modality.value} "
            f"meetings [{meetings}]"
        )


def print_summary(status: str, rows: Sequence[tuple[str, object]]) -> None:
    print("scheduler smoke test summary")
    print(f"status: {status}")
    for label, value in rows:
        print(f"{label}: {value}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run the test profile through the scheduler as a deployment smoke check."
    )
    parser.add_argument("--season", default="FALL")
    parser.add_argument("--year", type=int, default=2026)
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print all candidate section details.",
    )
    parser.add_argument(
        "--show-ui-sections",
        action="store_true",
        help="Print the solved schedule in UI serialization format.",
    )
    args = parser.parse_args()

    base_summary = [("term", f"{args.season} {args.year}")]

    try:
        database_url = database_url_from_env()
    except RuntimeError as exc:
        print_summary(
            "FAIL",
            [
                *base_summary,
                ("failure", exc),
            ],
        )
        return EXIT_FAILURE

    try:
        import psycopg
        from candidate_builder import get_candidate_sections
        from constraints_new import constraints_new
        from fixtures.test_profiles import build_language_symbolic_student_profile
        from run_rc2 import decode_schedule, schedule_to_ui_sections
    except ModuleNotFoundError as exc:
        print_summary(
            "FAIL",
            [
                *base_summary,
                ("failure", f"missing runtime dependency: {exc.name}"),
            ],
        )
        return EXIT_FAILURE

    student = build_language_symbolic_student_profile()
    requested_courses = student.major_electives | student.general_electives
    base_summary.append(("requested courses", len(requested_courses)))

    try:
        with psycopg.connect(database_url, connect_timeout=10) as conn:
            sections = get_candidate_sections(
                conn=conn,
                student_profile=student,
                term_season=args.season,
                term_year=args.year,
                requested_courses=requested_courses,
            )
    except psycopg.Error as exc:
        print_summary(
            "FAIL",
            [
                *base_summary,
                ("failure", f"database connection/query failed: {exc}"),
            ],
        )
        return EXIT_FAILURE

    if not sections:
        print_summary(
            "FAIL",
            [
                *base_summary,
                ("candidate sections", 0),
                ("failure", "no candidate sections returned"),
            ],
        )
        return EXIT_FAILURE

    if args.verbose:
        print_candidate_sections(sections)

    hard, soft, day_var_by_day = constraints_new(student, sections)

    model, cost = solve_schedule(hard, soft)
    if model is None:
        print_summary(
            "FAIL",
            [
                *base_summary,
                ("candidate sections", len(sections)),
                ("hard clauses", len(hard)),
                ("soft clauses", len(soft)),
                ("day variables", len(day_var_by_day)),
                ("solver result", "UNSAT"),
                (
                    "failure",
                    "hard constraints are unsatisfiable; likely causes include "
                    "credit lower bound, prerequisite filters, blocked-time filters, "
                    "or requirement caps",
                ),
            ],
        )
        return EXIT_FAILURE

    schedule = decode_schedule(model, sections)
    chosen_sections = sorted(schedule.classes, key=lambda section: section.class_num)

    print_summary(
        "PASS",
        [
            *base_summary,
            ("candidate sections", len(sections)),
            ("hard clauses", len(hard)),
            ("soft clauses", len(soft)),
            ("day variables", len(day_var_by_day)),
            ("solver result", "SAT"),
            ("cost", cost),
            ("credits", schedule.credits),
            ("selected sections", len(chosen_sections)),
        ],
    )

    print("selected schedule:")
    for section in chosen_sections:
        cid = section.course.course_id
        print(
            f"- {cid.subject_area} {cid.catalog_number} "
            f"section {section.section_code}; "
            f"class {section.class_num} "
            f"credits {section.course.credits}"
        )

    if args.show_ui_sections:
        print("ui sections:")
        for section in schedule_to_ui_sections(schedule):
            print(section)

    return EXIT_SUCCESS


if __name__ == "__main__":
    sys.exit(main())
