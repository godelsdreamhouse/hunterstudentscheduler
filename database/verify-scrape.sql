\set ON_ERROR_STOP on
REFRESH MATERIALIZED VIEW public.program_elective_courses;
SELECT 'departments' AS relation, count(*) FROM public.departments
UNION ALL SELECT 'courses', count(*) FROM public.courses
UNION ALL SELECT 'sections', count(*) FROM public.sections
UNION ALL SELECT 'section_meetings', count(*) FROM public.section_meetings
UNION ALL SELECT 'program_elective_courses', count(*) FROM public.program_elective_courses;
SELECT term_year, term_season, count(*) AS sections
FROM public.sections GROUP BY term_year, term_season ORDER BY term_year, term_season;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM public.courses) OR NOT EXISTS (SELECT FROM public.sections)
     OR NOT EXISTS (SELECT FROM public.section_meetings) THEN
    RAISE EXCEPTION 'Scrape verification failed: courses, sections, and meetings must be populated';
  END IF;
END $$;
