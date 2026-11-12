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

SELECT (
    COALESCE(
        current_setting('satisfi.synthetic_catalog_fixture', true) = 'local-development-only',
        FALSE
    )
    AND EXISTS (
        SELECT 1
        FROM pg_catalog.pg_db_role_setting setting
        WHERE setting.setdatabase = (
            SELECT oid
            FROM pg_catalog.pg_database
            WHERE datname = current_database()
        )
          AND setting.setrole = 0::OID
          AND 'satisfi.synthetic_catalog_fixture=local-development-only' = ANY(setting.setconfig)
    )
) AS satisfi_fixture_database_marked \gset
\if :satisfi_fixture_database_marked
\else
DO $$ BEGIN RAISE EXCEPTION 'exact database-level local synthetic-catalog marker and effective setting are required'; END $$;
\endif

BEGIN READ ONLY;
SET LOCAL search_path TO public;

DO $$
DECLARE
    marker CONSTANT TEXT := '[SATISFI SYNTHETIC FIXTURE v1]';
    fixture_course_count INTEGER;
    fixture_section_count INTEGER;
    fixture_meeting_count INTEGER;
    hide_full_count INTEGER;
BEGIN
    SELECT count(*) INTO fixture_course_count
    FROM courses c
    WHERE c.course_id IN (
        'satisfi-synth-2027-csci-127',
        'satisfi-synth-2027-math-150',
        'satisfi-synth-2027-polsc-110'
    )
      AND c.course_description LIKE marker || '%';

    SELECT count(*) INTO fixture_section_count
    FROM (
        VALUES
            (99027001, 'satisfi-synth-2027-csci-127'),
            (99027002, 'satisfi-synth-2027-csci-127'),
            (99027003, 'satisfi-synth-2027-math-150'),
            (99027004, 'satisfi-synth-2027-math-150'),
            (99027005, 'satisfi-synth-2027-polsc-110'),
            (99027006, 'satisfi-synth-2027-polsc-110')
    ) AS expected(class_num, course_id)
    JOIN sections s
      ON s.class_num = expected.class_num
     AND s.course_id = expected.course_id
     AND s.term_season = 'SPRING'
     AND s.term_year = 2027
     AND s.notes LIKE marker || '%'
    JOIN courses c
      ON c.course_id = s.course_id
     AND c.course_description LIKE marker || '%';

    SELECT count(*) INTO fixture_meeting_count
    FROM (
        VALUES
            (99027001, 'satisfi-synth-2027-csci-127'),
            (99027002, 'satisfi-synth-2027-csci-127'),
            (99027003, 'satisfi-synth-2027-math-150'),
            (99027004, 'satisfi-synth-2027-math-150'),
            (99027005, 'satisfi-synth-2027-polsc-110'),
            (99027006, 'satisfi-synth-2027-polsc-110')
    ) AS expected(class_num, course_id)
    JOIN sections s
      ON s.class_num = expected.class_num
     AND s.course_id = expected.course_id
     AND s.term_season = 'SPRING'
     AND s.term_year = 2027
     AND s.notes LIKE marker || '%'
    JOIN courses c
      ON c.course_id = s.course_id
     AND c.course_description LIKE marker || '%'
    JOIN section_meetings sm ON sm.section_id = s.section_id;

    IF fixture_course_count <> 3 OR fixture_section_count <> 6 OR fixture_meeting_count <> 6 THEN
        RAISE EXCEPTION 'fixture cardinality or ownership mismatch: courses %, sections %, meetings %',
            fixture_course_count, fixture_section_count, fixture_meeting_count;
    END IF;

    -- Compare both directions so the verifier rejects missing, extra, moved,
    -- or altered deterministic fixture values. The cardinality check above
    -- additionally makes duplicate meeting rows observable despite EXCEPT's
    -- set semantics.
    IF EXISTS (
        WITH expected (
            course_id, course_code, course_name, dep_code,
            course_description, credits, prerequisites, corequisites,
            prerequisites_notes, corequisites_notes, is_active, last_updated,
            catalog_attributes, requirement_designation
        ) AS (
            VALUES
                (
                    'satisfi-synth-2027-csci-127',
                    'SYNTH CSCI 12700',
                    '[SYNTHETIC] Introduction to Programming Patterns',
                    'CSCI',
                    '[SATISFI SYNTHETIC FIXTURE v1] Development-only catalog record; not a statement of Hunter offerings or degree applicability.',
                    3, ARRAY[]::TEXT[], ARRAY[]::TEXT[], NULL::TEXT,
                    NULL::TEXT, TRUE, DATE '2026-11-12',
                    ARRAY['SATISFI_SYNTHETIC_FIXTURE', 'SATISFI_SYNTHETIC_SEARCH_TOKEN_COMPUTING'],
                    NULL::TEXT
                ),
                (
                    'satisfi-synth-2027-math-150',
                    'SYNTH MATH 15000',
                    '[SYNTHETIC] Calculus Studio',
                    'MATH',
                    '[SATISFI SYNTHETIC FIXTURE v1] Development-only catalog record; not a statement of Hunter offerings or degree applicability.',
                    4, ARRAY[]::TEXT[], ARRAY[]::TEXT[], NULL::TEXT,
                    NULL::TEXT, TRUE, DATE '2026-11-12',
                    ARRAY['SATISFI_SYNTHETIC_FIXTURE', 'SATISFI_SYNTHETIC_SEARCH_TOKEN_NUMERIC'],
                    NULL::TEXT
                ),
                (
                    'satisfi-synth-2027-polsc-110',
                    'SYNTH POLSC 11000',
                    '[SYNTHETIC] Government and Public Life',
                    'POLSC',
                    '[SATISFI SYNTHETIC FIXTURE v1] Development-only catalog record; not a statement of Hunter offerings or degree applicability.',
                    3, ARRAY[]::TEXT[], ARRAY[]::TEXT[], NULL::TEXT,
                    NULL::TEXT, TRUE, DATE '2026-11-12',
                    ARRAY['SATISFI_SYNTHETIC_FIXTURE', 'SATISFI_SYNTHETIC_SEARCH_TOKEN_CIVIC'],
                    NULL::TEXT
                )
        ),
        actual AS (
            SELECT
                c.course_id, c.course_code, c.course_name, c.dep_code,
                c.course_description, c.credits, c.prerequisites,
                c.corequisites, c.prerequisites_notes, c.corequisites_notes,
                c.is_active, c.last_updated, c.catalog_attributes,
                c.requirement_designation
            FROM courses c
            WHERE c.course_id IN (
                'satisfi-synth-2027-csci-127',
                'satisfi-synth-2027-math-150',
                'satisfi-synth-2027-polsc-110'
            )
        ),
        differences AS (
            (SELECT * FROM expected EXCEPT SELECT * FROM actual)
            UNION ALL
            (SELECT * FROM actual EXCEPT SELECT * FROM expected)
        )
        SELECT 1 FROM differences
    ) THEN
        RAISE EXCEPTION 'fixture course tuples differ from the deterministic seed';
    END IF;

    IF EXISTS (
        WITH expected (
            class_num, course_id, term_season, term_year, section_number,
            section_component, group_code, instructor, instruction_mode,
            max_enrollment, enrollment, waitlist_max_enrollment,
            waitlist_count, enrollment_status, notes
        ) AS (
            VALUES
                (99027001, 'satisfi-synth-2027-csci-127', 'SPRING', 2027, 'S01',
                 'lecture'::component, NULL::TEXT, 'Synthetic Instructor A',
                 'in_person'::modality, 30, 12, 0, 0, 'open'::status,
                 '[SATISFI SYNTHETIC FIXTURE v1] Open, in-person, multi-meeting example.'),
                (99027002, 'satisfi-synth-2027-csci-127', 'SPRING', 2027, 'S02',
                 'lecture'::component, NULL::TEXT, 'Synthetic Instructor B',
                 'remote'::modality, 25, 25, 5, 0, 'closed'::status,
                 '[SATISFI SYNTHETIC FIXTURE v1] Full, synchronous remote example.'),
                (99027003, 'satisfi-synth-2027-math-150', 'SPRING', 2027, 'S01',
                 'lecture'::component, NULL::TEXT, 'Synthetic Instructor C',
                 'hybrid'::modality, 30, 28, 5, 2, 'waitlist'::status,
                 '[SATISFI SYNTHETIC FIXTURE v1] Below-capacity waitlist and hybrid example.'),
                (99027004, 'satisfi-synth-2027-math-150', 'SPRING', 2027, 'S02',
                 'lecture'::component, NULL::TEXT, 'Synthetic Instructor D',
                 'asynchronous'::modality, NULL::INTEGER, NULL::INTEGER,
                 NULL::INTEGER, NULL::INTEGER, NULL::status,
                 '[SATISFI SYNTHETIC FIXTURE v1] Unknown-capacity asynchronous example; no invented meeting.'),
                (99027005, 'satisfi-synth-2027-polsc-110', 'SPRING', 2027, 'S01',
                 'seminar'::component, NULL::TEXT, 'Synthetic Instructor E',
                 'in_person'::modality, 20, 8, 0, 0, 'open'::status,
                 '[SATISFI SYNTHETIC FIXTURE v1] Saturday example.'),
                (99027006, 'satisfi-synth-2027-polsc-110', 'SPRING', 2027, 'S02',
                 'discussion'::component, NULL::TEXT, 'Synthetic Instructor F',
                 'hybrid'::modality, 20, 10, 0, 0, 'open'::status,
                 '[SATISFI SYNTHETIC FIXTURE v1] Sunday example.')
        ),
        actual AS (
            SELECT
                s.class_num, s.course_id, s.term_season, s.term_year,
                s.section_number, s.section_component, s.group_code,
                s.instructor, s.instruction_mode, s.max_enrollment,
                s.enrollment, s.waitlist_max_enrollment, s.waitlist_count,
                s.enrollment_status, s.notes
            FROM sections s
            WHERE s.class_num BETWEEN 99027001 AND 99027006
              AND s.term_season = 'SPRING'
              AND s.term_year = 2027
        ),
        differences AS (
            (SELECT * FROM expected EXCEPT SELECT * FROM actual)
            UNION ALL
            (SELECT * FROM actual EXCEPT SELECT * FROM expected)
        )
        SELECT 1 FROM differences
    ) THEN
        RAISE EXCEPTION 'fixture section tuples differ from the deterministic seed';
    END IF;

    IF EXISTS (
        WITH expected (
            class_num, day_of_week, start_time, end_time, location
        ) AS (
            VALUES
                (99027001, ARRAY['Monday', 'Wednesday']::weekday[],
                 TIME '10:00', TIME '11:15', 'SYNTHETIC HN 1001'),
                (99027001, ARRAY['Friday']::weekday[],
                 TIME '10:00', TIME '10:50', 'SYNTHETIC HN 1001'),
                (99027002, ARRAY['Tuesday', 'Thursday']::weekday[],
                 TIME '13:00', TIME '14:15', 'SYNTHETIC ONLINE'),
                (99027003, ARRAY['Tuesday', 'Thursday']::weekday[],
                 TIME '09:30', TIME '10:45', 'SYNTHETIC HYBRID ROOM'),
                (99027005, ARRAY['Saturday']::weekday[],
                 TIME '09:00', TIME '11:30', 'SYNTHETIC HW 500'),
                (99027006, ARRAY['Sunday']::weekday[],
                 TIME '12:00', TIME '14:30', 'SYNTHETIC HYBRID ROOM')
        ),
        actual AS (
            SELECT
                s.class_num, sm.day_of_week, sm.start_time,
                sm.end_time, sm.location
            FROM section_meetings sm
            JOIN sections s ON s.section_id = sm.section_id
            WHERE s.class_num BETWEEN 99027001 AND 99027006
              AND s.term_season = 'SPRING'
              AND s.term_year = 2027
        ),
        differences AS (
            (SELECT * FROM expected EXCEPT SELECT * FROM actual)
            UNION ALL
            (SELECT * FROM actual EXCEPT SELECT * FROM expected)
        )
        SELECT 1 FROM differences
    ) THEN
        RAISE EXCEPTION 'fixture meeting tuples differ from the deterministic seed';
    END IF;

    -- After the documented second seed, exact marker-owned course/section
    -- mappings and the exact meeting count prove that no rows accumulated.
    IF EXISTS (
        SELECT 1
        FROM (
            VALUES
                ('satisfi-synth-2027-csci-127', 'CSCI'),
                ('satisfi-synth-2027-math-150', 'MATH'),
                ('satisfi-synth-2027-polsc-110', 'POLSC')
        ) AS expected(course_id, dep_code)
        LEFT JOIN courses c
          ON c.course_id = expected.course_id
         AND c.dep_code = expected.dep_code
         AND c.course_description LIKE marker || '%'
        WHERE c.course_id IS NULL
    ) THEN
        RAISE EXCEPTION 'exact marker-owned CSCI, MATH, and POLSC course mapping is missing';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM courses c
        WHERE c.course_id IN (
            'satisfi-synth-2027-csci-127',
            'satisfi-synth-2027-math-150',
            'satisfi-synth-2027-polsc-110'
        )
          AND c.course_description LIKE marker || '%'
          AND (
              c.catalog_attributes IS NULL
              OR NOT ('SATISFI_SYNTHETIC_FIXTURE' = ANY(c.catalog_attributes))
          )
    ) THEN
        RAISE EXCEPTION 'every fixture course must carry the explicit synthetic marker attribute';
    END IF;

    IF (
        SELECT count(DISTINCT s.instruction_mode)
        FROM (
            VALUES
                (99027001, 'satisfi-synth-2027-csci-127'),
                (99027002, 'satisfi-synth-2027-csci-127'),
                (99027003, 'satisfi-synth-2027-math-150'),
                (99027004, 'satisfi-synth-2027-math-150'),
                (99027005, 'satisfi-synth-2027-polsc-110'),
                (99027006, 'satisfi-synth-2027-polsc-110')
        ) AS expected(class_num, course_id)
        JOIN sections s
          ON s.class_num = expected.class_num
         AND s.course_id = expected.course_id
         AND s.term_season = 'SPRING'
         AND s.term_year = 2027
         AND s.notes LIKE marker || '%'
        JOIN courses c
          ON c.course_id = s.course_id
         AND c.course_description LIKE marker || '%'
    ) <> 4 THEN
        RAISE EXCEPTION 'fixture must cover in-person, remote, asynchronous, and hybrid modes';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM sections s JOIN courses c ON c.course_id = s.course_id
        WHERE s.class_num = 99027001
          AND s.course_id = 'satisfi-synth-2027-csci-127'
          AND s.term_season = 'SPRING' AND s.term_year = 2027
          AND s.notes LIKE marker || '%' AND c.course_description LIKE marker || '%'
          AND s.enrollment_status = 'open' AND s.enrollment < s.max_enrollment
    ) OR NOT EXISTS (
        SELECT 1 FROM sections s JOIN courses c ON c.course_id = s.course_id
        WHERE s.class_num = 99027002
          AND s.course_id = 'satisfi-synth-2027-csci-127'
          AND s.term_season = 'SPRING' AND s.term_year = 2027
          AND s.notes LIKE marker || '%' AND c.course_description LIKE marker || '%'
          AND s.enrollment = s.max_enrollment AND s.max_enrollment > 0
    ) OR NOT EXISTS (
        SELECT 1 FROM sections s JOIN courses c ON c.course_id = s.course_id
        WHERE s.class_num = 99027003
          AND s.course_id = 'satisfi-synth-2027-math-150'
          AND s.term_season = 'SPRING' AND s.term_year = 2027
          AND s.notes LIKE marker || '%' AND c.course_description LIKE marker || '%'
          AND s.enrollment_status = 'waitlist' AND s.waitlist_count = 2
          AND s.enrollment < s.max_enrollment
    ) OR NOT EXISTS (
        SELECT 1 FROM sections s JOIN courses c ON c.course_id = s.course_id
        WHERE s.class_num = 99027004
          AND s.course_id = 'satisfi-synth-2027-math-150'
          AND s.term_season = 'SPRING' AND s.term_year = 2027
          AND s.notes LIKE marker || '%' AND c.course_description LIKE marker || '%'
          AND s.max_enrollment IS NULL AND s.enrollment IS NULL
          AND s.enrollment_status IS NULL
    ) THEN
        RAISE EXCEPTION 'open, full, waitlist, or unknown-capacity fixture case is missing';
    END IF;

    -- This is the exact predicate used by GET /api/catalog/sections when
    -- hide_full=true. Status alone must not hide the below-capacity waitlist.
    SELECT count(*) INTO hide_full_count
    FROM (
        VALUES
            (99027001, 'satisfi-synth-2027-csci-127'),
            (99027002, 'satisfi-synth-2027-csci-127'),
            (99027003, 'satisfi-synth-2027-math-150'),
            (99027004, 'satisfi-synth-2027-math-150'),
            (99027005, 'satisfi-synth-2027-polsc-110'),
            (99027006, 'satisfi-synth-2027-polsc-110')
    ) AS expected(class_num, course_id)
    JOIN sections s
      ON s.class_num = expected.class_num
     AND s.course_id = expected.course_id
     AND s.term_season = 'SPRING'
     AND s.term_year = 2027
     AND s.notes LIKE marker || '%'
    JOIN courses c
      ON c.course_id = s.course_id
     AND c.course_description LIKE marker || '%'
    WHERE s.enrollment IS NULL
       OR s.max_enrollment IS NULL
       OR s.max_enrollment <= 0
       OR s.enrollment < s.max_enrollment;

    IF hide_full_count <> 5
       OR EXISTS (
           SELECT 1 FROM sections s JOIN courses c ON c.course_id = s.course_id
           WHERE s.class_num = 99027002
             AND s.course_id = 'satisfi-synth-2027-csci-127'
             AND s.term_season = 'SPRING' AND s.term_year = 2027
             AND s.notes LIKE marker || '%' AND c.course_description LIKE marker || '%'
             AND (s.enrollment IS NULL OR s.max_enrollment IS NULL
                  OR s.max_enrollment <= 0 OR s.enrollment < s.max_enrollment)
       )
       OR NOT EXISTS (
           SELECT 1 FROM sections s JOIN courses c ON c.course_id = s.course_id
           WHERE s.class_num = 99027003
             AND s.course_id = 'satisfi-synth-2027-math-150'
             AND s.term_season = 'SPRING' AND s.term_year = 2027
             AND s.notes LIKE marker || '%' AND c.course_description LIKE marker || '%'
             AND (s.enrollment IS NULL OR s.max_enrollment IS NULL
                  OR s.max_enrollment <= 0 OR s.enrollment < s.max_enrollment)
       ) THEN
        RAISE EXCEPTION 'hide-full semantics mismatch; expected 5 visible rows, including the below-capacity waitlist';
    END IF;

    IF (
        SELECT count(*)
        FROM section_meetings sm
        JOIN sections s ON s.section_id = sm.section_id
        JOIN courses c ON c.course_id = s.course_id
        WHERE s.class_num = 99027001
          AND s.course_id = 'satisfi-synth-2027-csci-127'
          AND s.term_season = 'SPRING' AND s.term_year = 2027
          AND s.notes LIKE marker || '%' AND c.course_description LIKE marker || '%'
    ) <> 2 THEN
        RAISE EXCEPTION 'multi-meeting fixture section must have exactly two meeting records';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM section_meetings sm
        JOIN sections s ON s.section_id = sm.section_id
        JOIN courses c ON c.course_id = s.course_id
        WHERE s.class_num = 99027005
          AND s.course_id = 'satisfi-synth-2027-polsc-110'
          AND s.term_season = 'SPRING' AND s.term_year = 2027
          AND s.notes LIKE marker || '%' AND c.course_description LIKE marker || '%'
          AND sm.day_of_week @> ARRAY['Saturday']::weekday[]
    ) OR NOT EXISTS (
        SELECT 1
        FROM section_meetings sm
        JOIN sections s ON s.section_id = sm.section_id
        JOIN courses c ON c.course_id = s.course_id
        WHERE s.class_num = 99027006
          AND s.course_id = 'satisfi-synth-2027-polsc-110'
          AND s.term_season = 'SPRING' AND s.term_year = 2027
          AND s.notes LIKE marker || '%' AND c.course_description LIKE marker || '%'
          AND sm.day_of_week @> ARRAY['Sunday']::weekday[]
    ) THEN
        RAISE EXCEPTION 'Saturday or Sunday meeting coverage is missing';
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
FROM (
    VALUES
        (99027001, 'satisfi-synth-2027-csci-127'),
        (99027002, 'satisfi-synth-2027-csci-127'),
        (99027003, 'satisfi-synth-2027-math-150'),
        (99027004, 'satisfi-synth-2027-math-150'),
        (99027005, 'satisfi-synth-2027-polsc-110'),
        (99027006, 'satisfi-synth-2027-polsc-110')
) AS expected(class_num, course_id)
JOIN sections s
  ON s.class_num = expected.class_num
 AND s.course_id = expected.course_id
 AND s.term_season = 'SPRING'
 AND s.term_year = 2027
 AND s.notes LIKE '[SATISFI SYNTHETIC FIXTURE v1]%'
JOIN courses c
  ON c.course_id = s.course_id
 AND c.course_description LIKE '[SATISFI SYNTHETIC FIXTURE v1]%'
LEFT JOIN section_meetings sm ON sm.section_id = s.section_id
GROUP BY s.class_num, c.course_code, s.section_number, s.instruction_mode,
         s.enrollment, s.max_enrollment, s.waitlist_count, s.enrollment_status
ORDER BY s.class_num;

ROLLBACK;
\echo 'Synthetic catalog fixture verification passed.'
