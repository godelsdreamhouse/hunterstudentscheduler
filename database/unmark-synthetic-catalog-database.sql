\set ON_ERROR_STOP on

-- Remove only the persistent database-level fixture permission. This does not
-- delete catalog rows; drop the disposable database when its data is unwanted.
\if :{?satisfi_allow_unmark_synthetic_database}
SELECT (:'satisfi_allow_unmark_synthetic_database' = '1') AS satisfi_unmarker_opted_in \gset
\else
\echo 'Refusing database-marker reset: pass -v satisfi_allow_unmark_synthetic_database=1 to psql.'
DO $$ BEGIN RAISE EXCEPTION 'explicit database-marker reset opt-in is required'; END $$;
\endif

\if :satisfi_unmarker_opted_in
\else
DO $$ BEGIN RAISE EXCEPTION 'database-marker reset opt-in must equal 1'; END $$;
\endif

SELECT format(
    'ALTER DATABASE %I RESET satisfi.synthetic_catalog_fixture',
    current_database()
) \gexec

SELECT NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_db_role_setting setting
    WHERE setting.setdatabase = (
        SELECT oid
        FROM pg_catalog.pg_database
        WHERE datname = current_database()
    )
      AND setting.setrole = 0::OID
      AND 'satisfi.synthetic_catalog_fixture=local-development-only' = ANY(setting.setconfig)
) AS satisfi_database_marker_removed \gset

\if :satisfi_database_marker_removed
\else
DO $$ BEGIN RAISE EXCEPTION 'database-level synthetic catalog marker was not removed'; END $$;
\endif

\echo 'Removed the current database synthetic-catalog marker.'
\echo 'Disconnect and reconnect before checking the effective setting.'
