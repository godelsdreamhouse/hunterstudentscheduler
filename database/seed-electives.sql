-- Run as database owner after course data has been loaded (PostgreSQL 18).
\set ON_ERROR_STOP on
BEGIN;
\ir migrations/001_program_elective_lookup.sql
-- The legacy migration recreates the view and therefore drops its grants.
GRANT SELECT, MAINTAIN ON program_elective_courses TO hunter_scraper;
COMMIT;
