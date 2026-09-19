-- Run with psql -X -f database/initialize-empty.sql against the new database.
-- Refuse to run the destructive legacy schema against an existing schema.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL search_path TO public;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
    ) OR EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public'
    ) THEN
        RAISE EXCEPTION 'Refusing initialization: public schema is not empty. Use migrations for an existing database.';
    END IF;
END
$$;

\ir schema.sql
COMMIT;
