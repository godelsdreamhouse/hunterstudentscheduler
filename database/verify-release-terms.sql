\set ON_ERROR_STOP on

-- The October release scrape is successful only once both newly released
-- Winter and Spring terms have at least one section in the catalog. Division
-- by zero intentionally makes psql fail when either term is still absent.
SELECT 1 / CASE
  WHEN count(DISTINCT term_season) = 2 THEN 1
  ELSE 0
END AS release_terms_ready
FROM public.sections
WHERE term_year = :'target_year'::INTEGER
  AND term_season IN ('WINTER', 'SPRING');
