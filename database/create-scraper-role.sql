-- Run as the database owner after initialization. Set the password separately.
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE hunter_scraper LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION CONNECTION LIMIT 5;
GRANT CONNECT ON DATABASE hunterscheduler TO hunter_scraper;
GRANT USAGE ON SCHEMA public TO hunter_scraper;
GRANT SELECT, INSERT, UPDATE ON departments, courses, sections, section_meetings TO hunter_scraper;
GRANT DELETE ON section_meetings TO hunter_scraper;
GRANT USAGE ON SEQUENCE sections_section_id_seq, section_meetings_meeting_id_seq TO hunter_scraper;
-- PostgreSQL 18 allows refresh without transferring materialized-view ownership.
GRANT SELECT, MAINTAIN ON program_elective_courses TO hunter_scraper;
COMMIT;
