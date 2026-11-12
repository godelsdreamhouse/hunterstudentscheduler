\set ON_ERROR_STOP on

-- This is a separate, persistent safety step. It marks only the database to
-- which psql is currently connected; it creates no tables or application data.
\if :{?satisfi_allow_mark_synthetic_database}
SELECT (:'satisfi_allow_mark_synthetic_database' = '1') AS satisfi_marker_opted_in \gset
\else
\echo 'Refusing database marker: pass -v satisfi_allow_mark_synthetic_database=1 to psql.'
DO $$ BEGIN RAISE EXCEPTION 'explicit database-marker opt-in is required'; END $$;
\endif

\if :satisfi_marker_opted_in
\else
DO $$ BEGIN RAISE EXCEPTION 'database-marker opt-in must equal 1'; END $$;
\endif

SELECT format(
    'ALTER DATABASE %I SET satisfi.synthetic_catalog_fixture = %L',
    current_database(),
    'local-development-only'
) \gexec

\echo 'Marked the current database for local synthetic-catalog fixtures.'
\echo 'Disconnect and reconnect before running the seed; database defaults do not change this session.'
