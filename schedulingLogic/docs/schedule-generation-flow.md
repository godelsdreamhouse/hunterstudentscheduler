# Schedule Generation Flow

## Purpose
Describe the end-to-end flow for generating student schedules.

## Inputs
- Degree Works audit PDF
- Student corrections to parsed data
- Desired classes/departments
- Unavailable times
- Credit range
- Preferences
- Registration term (`term_season`, `term_year`)

## Pipeline
1. Parser + UI payloads are transformed into `StudentProfile` using `input_builder.build_student_profile(...)`.
2. Candidate course IDs are built from:
   - `requirements_needed[*].fulfilled_by` course lists
   - fallback requirement attributes/tags (when `fulfilled_by` is empty)
   - any explicit requested courses
3. Candidate sections are pulled from DB with `candidate_builder.get_candidate_sections(conn, student, term_season, term_year, ...)`.
4. Candidate filtering excludes courses already in `student.classes_taken`.
5. SAT/MaxSAT constraints are generated from candidate sections.
6. WCNF is written to disk and solved with RC2.
7. Positive literals are decoded back into selected sections and returned as `Schedule(classes=[...])`.

## Current Hard Constraints (Implemented)
- Section conflicts with unavailable meeting times -> section forced false
- Course already taken -> excluded from candidate set before solving
- Additional hard constraints from section-level logic in `constraints_new.py`

## Current Soft Preferences (Implemented)
- Prefer morning sections
- Prefer afternoon sections
- Prefer evening sections
- Prefer in-person sections
- Prefer remote sections
- Day/gap related preferences are modeled in `constraints_new.py` (including day-variable support)

## Outputs
- A satisfiable/optimal schedule represented as selected section `class_num`s
- Decoded schedule object: `Schedule(classes=[Section, ...])`
