# Database

This directory contains the PostgreSQL schema used for the course schedule generator.

The database stores information about:
- departments
- courses
- degree requirements
- course offerings (sections)
- section meeting times

The schema is designed to support generating valid student schedules while respecting:
- time conflicts
- course requirements

---

## Directory Structure
database/
├── schema.sql
└── README.md


| File | Purpose |
|-----|------|
| `schema.sql` | Defines the database structure (tables, enums, constraints, indexes) |
---

## Running the Database
1. Clone the repository.

2. Create a `.env` file into /database.

    Each developer should use their own local credentials. The `.env` file is ignored by git and should not be committed.

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
    docker compose -f database/docker-compose.yml --env-file .env logs -f
    ```

5. Load the schema manually if it was not loaded during container initialization.

    The Docker Compose file mounts `schema.sql` into `/docker-entrypoint-initdb.d`, so PostgreSQL loads it automatically only when the database volume is first created. If the volume already existed, run:

    ```sh
    docker exec -i watchtower-postgres psql -U $POSTGRES_USER -d watchtower < database/schema.sql
    ```
6. Populate course and section data through the [scraper load workflow](../scraper/README.md).

7. Verify the database connection.

    ```sh
    psql -h localhost -U $POSTGRES_USER -d watchtower -c "SELECT 1;"
    ```

8. Configure the VS Code database extension if desired.

9. Stop the database container.

    ```sh
    docker stop watchtower-postgres
    ```

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
