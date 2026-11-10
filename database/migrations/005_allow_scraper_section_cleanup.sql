-- Run once as the database owner. Required for stale class-number reconciliation.
\set ON_ERROR_STOP on
BEGIN;
GRANT DELETE ON sections TO hunter_scraper;
COMMIT;
