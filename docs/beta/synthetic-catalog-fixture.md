# Local synthetic catalog fixture

The Spring 2027 fixture in `database/seed-synthetic-catalog.sql` provides a
small, deterministic catalog for local UI and API development. It contains
clearly synthetic Computer Science, Mathematics, and Political Science records.
It is not scraped Hunter data and makes no claim about course availability,
degree applicability, prerequisites, or academic eligibility.

The fixture covers:

- open, capacity-full, waitlist, and unknown-capacity sections;
- in-person, synchronous remote, asynchronous, and hybrid instruction;
- searchable catalog attributes;
- a section with multiple meeting records; and
- Saturday and Sunday meetings.

## Safety boundary

Use only a local or otherwise disposable development database. Never point
these commands at a production, staging, or shared database. The marker script
requires its own explicit opt-in and persistently marks the current database as
fixture-safe. Disconnecting does not remove that marker. The seed and verifier
require both its exact `pg_db_role_setting` entry for the current database with
`setrole = 0`, and the same effective `current_setting` after reconnect. A
session `SET`, `PGOPTIONS`, role default, or system default cannot substitute
for this database-level marker. The separate per-command psql variable
`satisfi_allow_synthetic_catalog=1` is also required.

The seed reserves course IDs beginning with `satisfi-synth-2027-` and class
numbers `99027001` through `99027006`. Before updating, it checks that any row
with those identifiers already bears the fixture marker. Each conflict update
also has an ownership predicate evaluated while PostgreSQL holds the row lock;
a transactional postcondition rolls back the seed if all three courses and six
sections were not acquired. It does not alter an existing CSCI, MATH, or POLSC
department row. Re-running it updates only marked fixture rows and replaces
only their meeting rows.

## Load and verify

First initialize or choose a disposable database using the repository's normal
local database instructions. Set a connection URL that you have independently
confirmed is disposable:

```sh
export SATISFI_DEV_DATABASE_URL='postgresql://LOCAL_USER:LOCAL_PASSWORD@127.0.0.1:5432/watchtower'
```

Persistently mark this one disposable database. This is a separate deliberate
action; the setting takes effect only in new connections:

```sh
psql "$SATISFI_DEV_DATABASE_URL" -X \
  -v satisfi_allow_mark_synthetic_database=1 \
  -f database/mark-synthetic-catalog-database.sql
```

The command exits after marking the database, so the following seed command is
the required new connection. Load the fixture:

```sh
psql "$SATISFI_DEV_DATABASE_URL" -X -v satisfi_allow_synthetic_catalog=1 \
  -f database/seed-synthetic-catalog.sql
```

Prove repeatability by loading the same seed a second time, then running the
read-only verifier. The verifier requires exactly three fixture courses, six
fixture sections, and six meeting records; duplicates or accumulated meetings
make it fail. It also checks the API's hide-full predicate, enrollment cases,
modalities, attributes, multi-meeting shape, and both weekend days.

```sh
psql "$SATISFI_DEV_DATABASE_URL" -X -v satisfi_allow_synthetic_catalog=1 \
  -f database/seed-synthetic-catalog.sql
psql "$SATISFI_DEV_DATABASE_URL" -X -v satisfi_allow_synthetic_catalog=1 \
  -f database/verify-synthetic-catalog.sql
```

An unmarked database must reject the seed even when the per-command opt-in is
present. Against a different, newly initialized disposable database, this is
expected to fail before `BEGIN` and write nothing:

```sh
psql "$UNMARKED_DISPOSABLE_DATABASE_URL" -X \
  -v satisfi_allow_synthetic_catalog=1 \
  -f database/seed-synthetic-catalog.sql
```

An effective session value must not bypass the database-level check. This
command against that same unmarked disposable database is also expected to fail
before `BEGIN`:

```sh
PGOPTIONS='-c satisfi.synthetic_catalog_fixture=local-development-only' \
psql "$UNMARKED_DISPOSABLE_DATABASE_URL" -X \
  -v satisfi_allow_synthetic_catalog=1 \
  -f database/seed-synthetic-catalog.sql
```

Omitting the per-command opt-in on a marked database is also expected to fail
without writing anything:

```sh
psql "$SATISFI_DEV_DATABASE_URL" -X -f database/seed-synthetic-catalog.sql
```

The public catalog route can then be exercised locally with term
`SPRING`/`2027` and a query such as `SYNTH`, `CSCI`, `MATH`, or `POLSC`.

## Collision and cross-term safety checks

These deliberate tests are for throwaway databases only. They were documented
for an environment with PostgreSQL available; they must not be run against a
shared database.

To test same-term collision refusal, initialize and mark a fresh disposable
database, then insert this non-fixture sentinel before running the seed:

```sql
INSERT INTO departments (dep_code, dep_name)
VALUES ('SENTINEL', 'Non-fixture collision sentinel');
INSERT INTO courses (course_id, course_code, course_name, dep_code)
VALUES ('collision-sentinel', 'SENTINEL 1', 'Non-fixture sentinel', 'SENTINEL');
INSERT INTO sections (
  class_num, course_id, term_season, term_year, section_number, notes
) VALUES (
  99027001, 'collision-sentinel', 'SPRING', 2027, 'COLLISION',
  'NON-FIXTURE COLLISION SENTINEL'
);
```

The seed must exit nonzero, and this query must still return the sentinel
unchanged:

```sql
SELECT course_id, notes FROM sections
WHERE class_num = 99027001 AND term_season = 'SPRING' AND term_year = 2027;
```

For cross-term isolation, use a different disposable database with a successful
fixture seed. Insert a Fall sentinel sharing a deterministic class number:

```sql
INSERT INTO sections (
  class_num, course_id, term_season, term_year, section_number, notes
) VALUES (
  99027001, 'satisfi-synth-2027-csci-127', 'FALL', 2027, 'CROSS-TERM',
  'NON-FIXTURE CROSS-TERM SENTINEL'
);
```

Run the Spring fixture seed again. It must succeed, while the following query
must still return the unchanged Fall sentinel:

```sql
SELECT course_id, section_number, notes FROM sections
WHERE class_num = 99027001 AND term_season = 'FALL' AND term_year = 2027;
```

## Remove the database marker

The safest cleanup is to drop the disposable database. If the database must be
retained, explicitly remove its persistent fixture permission:

```sh
psql "$SATISFI_DEV_DATABASE_URL" -X \
  -v satisfi_allow_unmark_synthetic_database=1 \
  -f database/unmark-synthetic-catalog-database.sql
```

Reconnect before checking or attempting another seed. The unmark script resets
only the database setting; it does not delete fixture or non-fixture rows. After
unmarking, even a `PGOPTIONS` value plus the per-run seed opt-in must be rejected
by the database-level provenance check described above.

## Limits

- These records validate catalog transport, department coverage, filtering,
  and presentation behavior, not Hunter data or supported-major workflows.
- The fixture intentionally does not seed programs, requirements, linked
  component associations, DegreeWorks data, or scheduler eligibility inputs.
- It does not create or change tables, migrations, database roles, or Python
  dependencies.
- The asynchronous example has no meeting row so development does not invent a
  time or day for an unscheduled section.
