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

Start the database container:
docker start watchtower-postgres

Stop the container:
docker stop watchtower-postgres

Create the schema:
psql -d database -f schema.sql

Load seed data:
psql -d database -f seed.sql
