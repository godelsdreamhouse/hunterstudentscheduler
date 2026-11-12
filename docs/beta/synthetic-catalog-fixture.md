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
these commands at a production, staging, or shared database. Both SQL files
refuse to run unless the explicit psql variable
`satisfi_allow_synthetic_catalog=1` is present.

The seed reserves course IDs beginning with `satisfi-synth-2027-` and class
numbers `99027001` through `99027006`. Before updating, it checks that any row
with those identifiers already bears the fixture marker. It does not alter an
existing CSCI, MATH, or POLSC department row. Re-running it updates only the
marked fixture rows and replaces only their meeting rows.

## Load and verify

First initialize or choose a disposable database using the repository's normal
local database instructions. Set a connection URL that you have independently
confirmed is disposable:

```sh
export SATISFI_DEV_DATABASE_URL='postgresql://LOCAL_USER:LOCAL_PASSWORD@127.0.0.1:5432/watchtower'
```

Load the fixture:

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

Omitting the opt-in is expected to fail without writing anything:

```sh
psql "$SATISFI_DEV_DATABASE_URL" -X -f database/seed-synthetic-catalog.sql
```

The public catalog route can then be exercised locally with term
`SPRING`/`2027` and a query such as `SYNTH`, `CSCI`, `MATH`, or `POLSC`.

## Limits

- These records validate transport and presentation behavior, not Hunter data.
- The fixture intentionally does not seed programs, requirements, linked
  component associations, DegreeWorks data, or scheduler eligibility inputs.
- It does not create or change tables, migrations, database roles, or Python
  dependencies.
- The asynchronous example has no meeting row so development does not invent a
  time or day for an unscheduled section.
