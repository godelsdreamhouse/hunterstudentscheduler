-- Run as the database owner. Set each password separately through hidden input.
\set ON_ERROR_STOP on
BEGIN;

CREATE ROLE hunter_web
    LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 10;
GRANT CONNECT ON DATABASE hunterscheduler TO hunter_web;
GRANT USAGE ON SCHEMA public TO hunter_web;
GRANT SELECT, INSERT ON users TO hunter_web;
GRANT SELECT, INSERT, UPDATE, DELETE ON "session" TO hunter_web;
GRANT SELECT ON courses, program_elective_courses TO hunter_web;

CREATE ROLE hunter_compute
    LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 8;
GRANT CONNECT ON DATABASE hunterscheduler TO hunter_compute;
GRANT USAGE ON SCHEMA public TO hunter_compute;
GRANT SELECT ON departments, courses, sections, section_meetings TO hunter_compute;

COMMIT;
