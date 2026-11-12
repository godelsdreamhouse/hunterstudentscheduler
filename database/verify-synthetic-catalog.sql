\set ON_ERROR_STOP on

\if :{?satisfi_allow_synthetic_catalog}
SELECT (:'satisfi_allow_synthetic_catalog' = '1') AS satisfi_fixture_opted_in \gset
\else
\echo 'Refusing synthetic catalog verification: pass -v satisfi_allow_synthetic_catalog=1 to psql.'
DO $$ BEGIN RAISE EXCEPTION 'explicit synthetic catalog opt-in is required'; END $$;
\endif

\if :satisfi_fixture_opted_in
\else
DO $$ BEGIN RAISE EXCEPTION 'explicit synthetic catalog opt-in must equal 1'; END $$;
\endif

BEGIN READ ONLY;
SET LOCAL search_path TO public;

DO $$
DECLARE
    fixture_course_count INTEGER;
    fixture_section_count INTEGER;
    fixture_meeting_count INTEGER;
    hide_full_count INTEGER;
BEGIN
    SELECT count(*) INTO fixture_course_count
    FROM courses
    WHERE course_id IN (
        'satisfi-synth-2027-csci-127',
        'satisfi-synth-2027-math-150',
        'satisfi-synth-2027-polsc-110'
    );

    SELECT count(*) INTO fixture_section_count
    FROM sections
    WHERE class_num BETWEEN 99027001 AND 99027006
      AND term_season = 'SPRING'
      AND term_year = 2027
      AND notes LIKE '[SATISFI SYNTHETIC FIXTURE v1]%';

    SELECT count(*) INTO fixture_meeting_count
    FROM section_meetings sm
    JOIN sections s ON s.section_id = sm.section_id
    WHERE s.class_num BETWEEN 99027001 AND 99027006
      AND s.term_season = 'SPRING'
      AND s.term_year = 2027;

    IF fixture_course_count <> 3 OR fixture_section_count <> 6 OR fixture_meeting_count <> 6 THEN
        RAISE EXCEPTION 'fixture cardinality mismatch: courses %, sections %, meetings %',
            fixture_course_count, fixture_section_count, fixture_meeting_count;
    END IF;

    IF (SELECT count(DISTINCT dep_code) FROM courses WHERE course_id IN (
        'satisfi-synth-2027-csci-127',
        'satisfi-synth-2027-math-150',
        'satisfi-synth-2027-polsc-110'
    )) <> 3 THEN
        RAISE EXCEPTION 'expected one fixture course in each of CSCI, MATH, and POLSC';
    END IF;

    IF EXISTS (
        SELECT 1 FROM courses
        WHERE course_id IN (
            'satisfi-synth-2027-csci-127',
            'satisfi-synth-2027-math-150',
            'satisfi-synth-2027-polsc-110'
        )
          AND (catalog_attributes IS NULL OR cardinality(catalog_attributes) < 2)
    ) THEN
        RAISE EXCEPTION 'every fixture course must expose synthetic catalog attributes';
    END IF;

    IF (SELECT count(DISTINCT instruction_mode) FROM sections
        WHERE class_num BETWEEN 99027001 AND 99027006
          AND term_season = 'SPRING' AND term_year = 2027) <> 4 THEN
        RAISE EXCEPTION 'fixture must cover in-person, remote, asynchronous, and hybrid modes';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM sections
        WHERE class_num = 99027001 AND enrollment_status = 'open'
          AND enrollment < max_enrollment
    ) OR NOT EXISTS (
        SELECT 1 FROM sections
        WHERE class_num = 99027002 AND enrollment = max_enrollment
          AND max_enrollment > 0
    ) OR NOT EXISTS (
        SELECT 1 FROM sections
        WHERE class_num = 99027003 AND enrollment_status = 'waitlist'
          AND waitlist_count = 2 AND enrollment < max_enrollment
    ) OR NOT EXISTS (
        SELECT 1 FROM sections
        WHERE class_num = 99027004 AND max_enrollment IS NULL
          AND enrollment IS NULL AND enrollment_status IS NULL
    ) THEN
        RAISE EXCEPTION 'open, full, waitlist, or unknown-capacity fixture case is missing';
    END IF;

    -- This is the exact predicate used by GET /api/catalog/sections when
    -- hide_full=true. Status alone must not hide the below-capacity waitlist.
    SELECT count(*) INTO hide_full_count
    FROM sections s
    WHERE s.class_num BETWEEN 99027001 AND 99027006
      AND s.term_season = 'SPRING'
      AND s.term_year = 2027
      AND (
          s.enrollment IS NULL
          OR s.max_enrollment IS NULL
          OR s.max_enrollment <= 0
          OR s.enrollment < s.max_enrollment
      );

    IF hide_full_count <> 5
       OR EXISTS (
           SELECT 1 FROM sections s
           WHERE s.class_num = 99027002
             AND (s.enrollment IS NULL OR s.max_enrollment IS NULL
                  OR s.max_enrollment <= 0 OR s.enrollment < s.max_enrollment)
       )
       OR NOT EXISTS (
           SELECT 1 FROM sections s
           WHERE s.class_num = 99027003
             AND (s.enrollment IS NULL OR s.max_enrollment IS NULL
                  OR s.max_enrollment <= 0 OR s.enrollment < s.max_enrollment)
       ) THEN
        RAISE EXCEPTION 'hide-full semantics mismatch; expected 5 visible rows, including the below-capacity waitlist';
    END IF;

    IF (SELECT count(*) FROM section_meetings sm JOIN sections s USING (section_id)
        WHERE s.class_num = 99027001) <> 2 THEN
        RAISE EXCEPTION 'multi-meeting fixture section must have exactly two meeting records';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM section_meetings sm JOIN sections s USING (section_id)
        WHERE s.class_num = 99027005
          AND sm.day_of_week @> ARRAY['Saturday']::weekday[]
    ) OR NOT EXISTS (
        SELECT 1 FROM section_meetings sm JOIN sections s USING (section_id)
        WHERE s.class_num = 99027006
          AND sm.day_of_week @> ARRAY['Sunday']::weekday[]
    ) THEN
        RAISE EXCEPTION 'Saturday or Sunday meeting coverage is missing';
    END IF;

    IF EXISTS (
        SELECT class_num
        FROM sections
        WHERE class_num BETWEEN 99027001 AND 99027006
          AND term_season = 'SPRING' AND term_year = 2027
        GROUP BY class_num
        HAVING count(*) <> 1
    ) THEN
        RAISE EXCEPTION 'fixture seed is not idempotent: duplicate deterministic sections detected';
    END IF;
END
$$;

SELECT
    s.class_num,
    c.course_code,
    s.section_number,
    s.instruction_mode,
    s.enrollment,
    s.max_enrollment,
    s.waitlist_count,
    s.enrollment_status,
    count(sm.meeting_id) AS meeting_records
FROM sections s
JOIN courses c ON c.course_id = s.course_id
LEFT JOIN section_meetings sm ON sm.section_id = s.section_id
WHERE s.class_num BETWEEN 99027001 AND 99027006
  AND s.term_season = 'SPRING'
  AND s.term_year = 2027
GROUP BY s.class_num, c.course_code, s.section_number, s.instruction_mode,
         s.enrollment, s.max_enrollment, s.waitlist_count, s.enrollment_status
ORDER BY s.class_num;

ROLLBACK;
\echo 'Synthetic catalog fixture verification passed.'
