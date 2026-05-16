# Scheduler Deployment

This document covers the Python scheduler service under `schedulingLogic`.
Run commands from this directory unless noted otherwise because the modules use
package-local imports such as `candidate_builder` and `constraints_new`.

## Runtime

- Python: 3.10 or newer. The scheduler uses modern type syntax such as
  `list[dict]` and `str | None`.
- Current local workspace check: `python3 --version` reports Python 3.14.4.
- Dependencies are listed in `requirements.txt`.

## Environment Setup

```bash
cd schedulingLogic
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

## Database Configuration

The scheduler needs PostgreSQL access for candidate section lookup.

Preferred API configuration:

```bash
export DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require'
```

The smoke test also accepts the shared Supabase pooler password and builds the
connection string internally:

```bash
export DB_PASSWORD='...'
```

Set `DATABASE_URL` for the API. If it is missing, schedule generation returns a
normal scheduler response with empty `sections` and this error:

```json
{
  "code": "DATABASE_CONNECTION_FAILED",
  "message": "Schedule generation is temporarily unavailable."
}
```

`DB_PASSWORD` is only used by helper scripts such as `db_ping.py` and
`run_test_profile_scheduler.py`; `api.py` reads `DATABASE_URL`.

## Optional Debug Logging

Candidate section lookup has opt-in debug output:

```bash
export CANDIDATE_BUILDER_DEBUG=1
```

Accepted truthy values are `1`, `true`, `yes`, and `on`. When enabled,
`candidate_builder.py` prints lines prefixed with `[candidate_builder]`.

## Smoke Checks

Check direct database connectivity with:

```bash
python db_ping.py
```

Expected behavior:

- Prints `connecting...`.
- Prints a row containing the current database and user.
- Fails with a missing `DB_PASSWORD` error if `DB_PASSWORD` is not set.

Run the scheduler deployment smoke test with either `DATABASE_URL` or
`DB_PASSWORD` set:

```bash
python run_test_profile_scheduler.py --season FALL --year 2026
```

Expected passing behavior:

- Prints `scheduler smoke test summary`.
- Prints `status: PASS`.
- Reports nonzero candidate sections, hard clauses, soft clauses, selected
  sections, and `solver result: SAT`.
- Prints a `selected schedule:` list.

Expected failure behavior:

- Exits nonzero.
- Prints `status: FAIL`.
- Includes a `failure:` line explaining missing configuration, missing runtime
  dependency, database connection/query failure, no candidate sections, or an
  unsatisfiable solver result.

Useful verbose modes:

```bash
python run_test_profile_scheduler.py --verbose
python run_test_profile_scheduler.py --show-ui-sections
```

## Run the API

```bash
cd schedulingLogic
source .venv/bin/activate
export DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require'
uvicorn api:app --host 0.0.0.0 --port 8000
```

The scheduler API exposes:

```text
POST /api/schedule/generate
```

Use the example request shape in `examples/generate_schedule_request.json` and
the field documentation in `docs/api-schedule-generate-request.md`.

Expected healthy API behavior:

- `uvicorn` starts without import errors.
- A valid `POST /api/schedule/generate` request with database access returns
  JSON containing `score`, `credits`, and `sections`.
- If no eligible sections are found, or constraints cannot be solved, the API
  still returns the same top-level response shape and includes an `error` object.

There is currently no dedicated scheduler `GET /health` endpoint in `api.py`.
Use the smoke test above for deployment readiness, and use the API process start
plus a representative schedule-generation request for runtime verification.
