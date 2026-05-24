-- Removes deprecated requirement lookup tables from shared databases.

-- These tables are no longer part of the canonical rebuild schema. Use this
-- migration on Supabase instead of rerunning schema.sql, so scraped course,
-- section, department, and meeting data stays intact.
DROP TABLE IF EXISTS course_requirements_map CASCADE;
DROP TABLE IF EXISTS course_requirements CASCADE;
