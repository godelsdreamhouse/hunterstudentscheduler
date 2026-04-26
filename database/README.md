# Database

This directory contains the PostgreSQL schema and seed data used for the course schedule generator.

The database stores information about:
- departments
- courses
- degree requirements
- course offerings (sections)
- section meeting times

The schema is designed to support generating valid student schedules while respecting:
- time conflicts
- course requirements
- linked components such as lecture + lab + recitation.

---

## Directory Structure
database/
├── schema.sql
├── seed.sql
└── README.md


| File | Purpose |
|-----|------|
| `schema.sql` | Defines the database structure (tables, enums, constraints, indexes) |
| `seed.sql` | Populates the database with some initial course catalog and requirement data |

---

## Running the Database
1. Clone the repository
2. Start the database container
    docker start watchtower-postgres 

    or automatic for schema upload

    docker-compose up -d 

3. View logs 
    docker-compose logs -f

4. Create your personal database user 
    CREATE USER $USERNAME WITH PASSWORD '$PASSWORD';
    ALTER USER $USERNAME WITH SUPERUSER;
    GRANT ALL PRIVILEGES ON DATABASE watchtower TO $USERNAME;
    GRANT ALL ON SCHEMA public TO $USERNAME;

5. Use .env.example to create .env file with your own new credentials

6. Load schema if you did not automatically upload per step 2
    docker exec -it watchtower-postgres psql -U $USERNAME -d watchtower 

    docker exec -i watchtower-postgres \
    psql -U $USERNAME -d watchtower < schema.sql

7. Verify connection

8. Configure VS Code extension (optional). Check Google Doc for more detail.

9. Stop container
    docker stop watchtower-postgres 

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