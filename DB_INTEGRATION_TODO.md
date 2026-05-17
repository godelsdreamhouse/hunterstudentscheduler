# DB Integration Handoff (Scheduler)

## Current status
- Scheduler side has a DB candidate loader implemented in:
  - `/Users/micahbobicah/Downloads/school/spring 2026/capstone/schedulingLogic/candidate_builder.py`
- Candidate flow implemented:
  - needed exact courses + needed tags + requested courses -> target course IDs -> term-filtered sections + meetings.
- Conversions implemented:
  - DB course IDs like `CSCI_13500` -> model course IDs.
  - DB day/time/modality -> model enums/integers.
- Requirement tags are loaded and attached to `Course.fulfills`.

## Why integration is blocked right now
- No running local `watchtower-postgres` container exists yet on this machine.
- `docker start watchtower-postgres` fails because the container was never created.
- DB credentials/source-of-truth for local env are not yet confirmed with teammate.

## Files already verified
- `/Users/micahbobicah/Downloads/school/spring 2026/capstone/database/schema.sql`
- `/Users/micahbobicah/Downloads/school/spring 2026/capstone/database/docker-compose.yml`
- `/Users/micahbobicah/Downloads/school/spring 2026/capstone/database/README.md`

## Open questions for DB teammate - NOW ANSWERED IN database/README.md
1. Confirm canonical local startup path (Docker compose in `/database`) and expected `.env` values.
2. Confirm whether shared defaults are used for `POSTGRES_USER` / `POSTGRES_PASSWORD`.
3. Confirm whether `watchtower-postgres` should already exist or if each dev creates it locally.
4. Confirm table/column naming stability for day/modality/credits mapping.

## Exact next steps when teammate is available
1. Create/start DB container:
   - `cd "/Users/micahbobicah/Downloads/school/spring 2026/capstone"`
   - Download docker desktop
   - `docker compose -f database/docker-compose.yml --env-file database/.env up -d`
2. Load schema:
   - `docker exec -i watchtower-postgres psql -U <USER> -d watchtower < database/schema.sql`
3. Verify DB is reachable:
   - `psql -h localhost -U <USER> -d watchtower -c "SELECT 1;"`
4. Run scheduler DB integration test (new script to add):
   - Build `StudentProfile` from dummy parser/UI payload.
   - Call `get_candidate_sections(...)`.
   - Print first few mapped sections/meetings to validate mapping.
5. Feed candidates into solver pipeline:
   - `constraints(...) -> write_wcnf(...) -> RC2`
6. Decode solver output to readable schedule rows for UI.

## Known model/schema mismatch TODOs (already flagged in code)
- DB `section_id` is mapped to solver `class_num`.
- DB modality values differ from model enum values. HANDLED IN CANDIDATE_BUILDER.PY
- DB weekday values differ from model enum values.   HANDLED IN CANDIDATE_BUILDER.PY
- DB `credits` is numeric(3,1) while model currently uses int.  CHANGED.
- Prereq/coreq not yet loaded from current schema slice.
- Academic career defaults to undergrad for now.

## Suggested immediate implementation tasks (ordered)
1. Add `run_integration.py` in `schedulingLogic` to test DB -> candidates -> print results.
2. Wire solver call in same script to test end-to-end on real DB data.
3. Add readable decoder output (course/section/day-time/modality/instructor).
4. Remove temporary assumptions after DB teammate confirms schema/values.
