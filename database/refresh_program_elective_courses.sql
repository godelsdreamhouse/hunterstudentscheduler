-- Rebuilds the lookup used by the preferences page smart search.

-- Run this after the scraper updates courses or after elective rules change.
REFRESH MATERIALIZED VIEW program_elective_courses;
