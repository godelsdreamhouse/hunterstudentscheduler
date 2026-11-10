\set ON_ERROR_STOP on

-- The October release scrape is successful once the newly released Spring
-- term has at least one section in the catalog. Division by zero intentionally
-- makes psql fail while Spring is still absent.
SELECT 1 / CASE
  WHEN EXISTS (
    SELECT 1
    FROM public.sections
    WHERE term_year = :'target_year'::INTEGER
      AND term_season = 'SPRING'
  ) THEN 1
  ELSE 0
END AS release_terms_ready;
