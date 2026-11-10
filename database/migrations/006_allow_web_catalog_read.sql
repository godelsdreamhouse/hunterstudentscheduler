-- Run once as the database owner. Required by the public catalog API.
\set ON_ERROR_STOP on
BEGIN;
GRANT SELECT ON courses, sections, section_meetings TO hunter_web;
COMMIT;
