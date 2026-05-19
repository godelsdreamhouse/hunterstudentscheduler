# Database

This directory contains the PostgreSQL schema used for the course schedule generator.


---

## Directory Structure
database/
├── schema.sql
├── docker-compose.yml
├── refresh_program_elective_courses.sql
├── migrations/
└── README.md


| File | Purpose |
|-----|------|
| `schema.sql` | Defines the database structure (tables, enums, constraints, indexes) |
| `docker-compose.yml` | Runs local Postgres and mounts database SQL files |
| `migrations/001_program_elective_lookup.sql` | Seeds supported programs, elective rules, and exclusions |
| `refresh_program_elective_courses.sql` | Refreshes the materialized elective lookup after course data changes |
---

## Local Database
1. Clone the repository.

2. Create a `.env` file in `/database`.

    Each developer should use their own local credentials. The `.env` file is ignored by git and should not be committed.

    ```sh
    cp database/.env.example database/.env
    ```

    ```env
    POSTGRES_USER=<your_username>
    POSTGRES_PASSWORD=<your_password>
    POSTGRES_DB=watchtower
    ```

3. Create and start the database container from the repository root.
    
    The `watchtower-postgres` container does not need to already exist. Docker Compose will create it the first time this command runs. Must have Docker Desktop downloaded.

    ```sh
    docker compose -f database/docker-compose.yml --env-file database/.env up -d
    ```

4. View database logs.

    ```sh
    docker compose -f database/docker-compose.yml --env-file database/.env logs -f
    ```

5. Load the schema manually if it was not loaded during container initialization.

    The Docker Compose file mounts `schema.sql` into `/docker-entrypoint-initdb.d`, so PostgreSQL loads it automatically only when the database volume is first created. If the volume already existed, run:

    ```sh
    docker exec -i watchtower-postgres psql -U $POSTGRES_USER -d watchtower < database/schema.sql
    ```
6. Populate course and section data through the [scraper load workflow](../scraper/README.md) only if the local database does not already have scraped data.

7. Seed program elective rules after course data exists.

    ```sh
    docker exec watchtower-postgres psql -U $POSTGRES_USER -d watchtower -f /watchtower-db/migrations/001_program_elective_lookup.sql
    ```

8. Refresh the program elective lookup.

    ```sh
    docker exec watchtower-postgres psql -U $POSTGRES_USER -d watchtower -f /watchtower-db/refresh_program_elective_courses.sql
    ```

10. Verify the database connection.

    ```sh
    psql -h localhost -U $POSTGRES_USER -d watchtower -c "SELECT 1;"
    ```

11. Configure the VS Code database extension if desired.

12. Stop the database container.

    ```sh
    docker stop watchtower-postgres
    ```

---

## Deployed Database
Use the deployed database connection string instead of Docker commands.

1. Set `DATABASE_URL`.

    ```sh
    export DATABASE_URL='postgresql://USER:PASSWORD@HOST:5432/DB_NAME?sslmode=require'
    ```

2. Verify the connection.

    ```sh
    psql "$DATABASE_URL" -c "SELECT 1;"
    ```

3. Run migrations when schema or program elective seed data changes.

    ```sh
    psql "$DATABASE_URL" -f database/migrations/001_program_elective_lookup.sql
    ```

4. Refresh the program elective lookup after running elective seed changes.

    ```sh
    psql "$DATABASE_URL" -f database/refresh_program_elective_courses.sql
    ```

The deployed database already has scraped course data. Do not run the scraper during normal deploys unless it is the planned semester data refresh.

Do not use `docker exec` for the deployed database. Those commands only apply to the local `watchtower-postgres` container.

---

## Semester Course Data Refresh
Course data is expected to be rescraped once per semester.

Run these steps for the semester refresh:

1. Run the scraper load workflow against the target database.
2. Seed/update program elective rules.
3. Refresh `program_elective_courses`.

The materialized view does not update automatically when `courses` changes. Refresh it after the semester scrape completes.

For local Docker:

```sh
docker exec watchtower-postgres psql -U $POSTGRES_USER -d watchtower -f /watchtower-db/migrations/001_program_elective_lookup.sql
docker exec watchtower-postgres psql -U $POSTGRES_USER -d watchtower -f /watchtower-db/refresh_program_elective_courses.sql
```

For the deployed database:

```sh
psql "$DATABASE_URL" -f database/migrations/001_program_elective_lookup.sql
psql "$DATABASE_URL" -f database/refresh_program_elective_courses.sql
```

The Docker Compose file only auto-runs `schema.sql` when the Postgres volume is first created. The elective seed and refresh files are mounted at `/watchtower-db` so they can be run manually after scraped data exists.

---

## Adding More Programs
To add another major or minor, update `migrations/001_program_elective_lookup.sql`.

1. Add the program to the `INSERT INTO programs` values.

    ```sql
    ('Sociology_None', 'Sociology Major', 'SOC', '{}')
    ```

2. Add the `program_key` to the rule replacement list.

    ```sql
    'Sociology_None'
    ```

3. Add elective rules for the program.

    Prefix rules match course numbers that start with the given value. For example, `SOC 3@` means SOC courses whose catalog number starts with `3`.

    ```sql
    INSERT INTO program_elective_rules (
        program_id,
        dep_code,
        operator,
        catalog_number_prefix
    )
    SELECT p.program_id, r.dep_code, 'prefix', r.catalog_number_prefix
    FROM programs p
    JOIN (
        VALUES
            ('SOC', '2'),
            ('SOC', '3'),
            ('SOC', '4')
    ) AS r(dep_code, catalog_number_prefix)
        ON p.program_key = 'Sociology_None';
    ```

    Use `operator = '>'` for rules like `CSCI >13600`.

4. Add exclusions if the program has courses that should not count.

    ```sql
    INSERT INTO program_elective_exclusions (program_id, course_code)
    SELECT p.program_id, e.course_code
    FROM programs p
    JOIN (
        VALUES
            ('SOC 49900')
    ) AS e(course_code)
        ON p.program_key = 'Sociology_None'
    ON CONFLICT (program_id, course_code) DO NOTHING;
    ```

5. Run the migration and refresh the materialized view.

    ```sh
    psql "$DATABASE_URL" -f database/migrations/001_program_elective_lookup.sql
    psql "$DATABASE_URL" -f database/refresh_program_elective_courses.sql
    ```

Before adding rules, confirm the scraper has populated matching `departments.dep_code` and `courses.course_code` values.

---

## Other Useful Database Commands
- List volumes:
docker volume ls

- List all databases:
\l

- List all tables:
\dt

- Describe a table:
\d courses

- List all users:
\du

- Exit psql:
\q
