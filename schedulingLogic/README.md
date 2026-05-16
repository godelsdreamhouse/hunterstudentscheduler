# Scheduler Service

The scheduler service turns parser and UI payloads into a set of candidate
course sections, builds MaxSAT constraints, solves for a schedule, and returns
UI-ready section data.

## Structure

```text
schedulingLogic/
  api.py                         FastAPI endpoint for schedule generation
  models.py                      Scheduler domain model
  input_builder.py               Parser/UI payload to StudentProfile adapter
  candidate_builder.py           Database candidate section loader
  constraints_new.py             Current hard/soft constraint builder
  run_rc2.py                     Solver decode and UI serialization helpers
  wcnf.py                        Weighted CNF writer
  errors.py                      API error code helpers
  tools/                         Local smoke-test and DB helper scripts
  fixtures/                      Reusable test profile and legacy fixture data
  docs/                          Scheduler-specific API and flow docs
  examples/                      Sample API request payloads
  generated/                     Generated WCNF artifacts
  legacy/                        Older local demo code retained for reference
```

## Setup

From the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r schedulingLogic/requirements.txt
```

Copy the environment template when running locally:

```bash
cp schedulingLogic/.env.example schedulingLogic/.env
```

Do not commit `.env` files or real database credentials.

## Run the API

```bash
export DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require'
uvicorn api:app --app-dir schedulingLogic --host 0.0.0.0 --port 8000
```

The primary endpoint is:

```text
POST /api/schedule/generate
```

See `docs/api-schedule-generate-request.md` and
`examples/generate_schedule_request.json` for the current integration contract.

## Smoke Test

The deployment smoke test uses the reusable test profile in `fixtures/` and can
run with either `DATABASE_URL` or `DB_PASSWORD` set:

```bash
.venv/bin/python schedulingLogic/tools/run_test_profile_scheduler.py --season FALL --year 2026
```

A passing run prints `status: PASS`, a SAT solver result, and the selected
sections.

## Code Style

Scheduler Python code should follow PEP 8 naming and formatting conventions.
Public modules and helpers should use docstrings when their behavior, inputs,
outputs, or side effects are not obvious from the implementation.

## More Deployment Notes

See `DEPLOYMENT.md` for Docker, environment, debug logging, and runtime
verification details.
