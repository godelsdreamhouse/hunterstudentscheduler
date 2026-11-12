\set ON_ERROR_STOP on

-- This fixture is intentionally awkward to invoke: it is for disposable local
-- databases only. It never connects to a database on its own; psql's current
-- connection is the entire scope of the write.
\if :{?satisfi_allow_synthetic_catalog}
SELECT (:'satisfi_allow_synthetic_catalog' = '1') AS satisfi_fixture_opted_in \gset
\else
\echo 'Refusing synthetic catalog seed: pass -v satisfi_allow_synthetic_catalog=1 to psql.'
DO $$ BEGIN RAISE EXCEPTION 'explicit synthetic catalog opt-in is required'; END $$;
\endif

\if :satisfi_fixture_opted_in
\else
\echo 'Refusing synthetic catalog seed: satisfi_allow_synthetic_catalog must equal 1.'
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
\echo 'Refusing synthetic catalog seed: this database lacks the exact database-level local fixture marker.'
\echo 'Run database/mark-synthetic-catalog-database.sql explicitly, then reconnect.'
DO $$ BEGIN RAISE EXCEPTION 'persistent local synthetic-catalog database marker is required'; END $$;
\endif

BEGIN;
SET LOCAL search_path TO public;

-- Serialize repeated fixture loads in case two local commands are started at
-- once. This lock is transaction-scoped and has no persistent database state.
SELECT pg_advisory_xact_lock(hashtext('satisfi-synthetic-catalog-spring-2027-v1'));

-- Deterministic identifiers are useful for UI and API development, but must
-- never take ownership of an unrelated row. Refuse collisions before upserts.
DO $$
DECLARE
    marker CONSTANT TEXT := '[SATISFI SYNTHETIC FIXTURE v1]';
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.courses
        WHERE course_id IN (
            'satisfi-synth-2027-csci-127',
            'satisfi-synth-2027-math-150',
            'satisfi-synth-2027-polsc-110'
        )
          AND (course_description IS NULL OR course_description NOT LIKE marker || '%')
    ) THEN
        RAISE EXCEPTION 'refusing to overwrite a non-fixture course with a reserved synthetic course_id';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.sections
        WHERE class_num BETWEEN 99027001 AND 99027006
          AND term_season = 'SPRING'
          AND term_year = 2027
          AND (notes IS NULL OR notes NOT LIKE marker || '%')
    ) THEN
        RAISE EXCEPTION 'refusing to overwrite a non-fixture section with a reserved synthetic class number';
    END IF;
END
$$;

-- Existing real department rows are preserved byte-for-byte.
INSERT INTO public.departments (dep_code, dep_name)
VALUES
    ('CSCI', 'Computer Science'),
    ('MATH', 'Mathematics'),
    ('POLSC', 'Political Science')
ON CONFLICT (dep_code) DO NOTHING;

INSERT INTO public.courses (
    course_id,
    course_code,
    course_name,
    dep_code,
    course_description,
    credits,
    prerequisites,
    corequisites,
    prerequisites_notes,
    corequisites_notes,
    is_active,
    last_updated,
    catalog_attributes,
    requirement_designation
)
VALUES
    (
        'satisfi-synth-2027-csci-127',
        'SYNTH CSCI 12700',
        '[SYNTHETIC] Introduction to Programming Patterns',
        'CSCI',
        '[SATISFI SYNTHETIC FIXTURE v1] Development-only catalog record; not a statement of Hunter offerings or degree applicability.',
        3,
        ARRAY[]::TEXT[],
        ARRAY[]::TEXT[],
        NULL,
        NULL,
        TRUE,
        DATE '2026-11-12',
        ARRAY['SATISFI_SYNTHETIC_FIXTURE', 'SATISFI_SYNTHETIC_SEARCH_TOKEN_COMPUTING'],
        NULL
    ),
    (
        'satisfi-synth-2027-math-150',
        'SYNTH MATH 15000',
        '[SYNTHETIC] Calculus Studio',
        'MATH',
        '[SATISFI SYNTHETIC FIXTURE v1] Development-only catalog record; not a statement of Hunter offerings or degree applicability.',
        4,
        ARRAY[]::TEXT[],
        ARRAY[]::TEXT[],
        NULL,
        NULL,
        TRUE,
        DATE '2026-11-12',
        ARRAY['SATISFI_SYNTHETIC_FIXTURE', 'SATISFI_SYNTHETIC_SEARCH_TOKEN_NUMERIC'],
        NULL
    ),
    (
        'satisfi-synth-2027-polsc-110',
        'SYNTH POLSC 11000',
        '[SYNTHETIC] Government and Public Life',
        'POLSC',
        '[SATISFI SYNTHETIC FIXTURE v1] Development-only catalog record; not a statement of Hunter offerings or degree applicability.',
        3,
        ARRAY[]::TEXT[],
        ARRAY[]::TEXT[],
        NULL,
        NULL,
        TRUE,
        DATE '2026-11-12',
        ARRAY['SATISFI_SYNTHETIC_FIXTURE', 'SATISFI_SYNTHETIC_SEARCH_TOKEN_CIVIC'],
        NULL
    )
ON CONFLICT (course_id) DO UPDATE SET
    course_code = EXCLUDED.course_code,
    course_name = EXCLUDED.course_name,
    dep_code = EXCLUDED.dep_code,
    course_description = EXCLUDED.course_description,
    credits = EXCLUDED.credits,
    prerequisites = EXCLUDED.prerequisites,
    corequisites = EXCLUDED.corequisites,
    prerequisites_notes = EXCLUDED.prerequisites_notes,
    corequisites_notes = EXCLUDED.corequisites_notes,
    is_active = EXCLUDED.is_active,
    last_updated = EXCLUDED.last_updated,
    catalog_attributes = EXCLUDED.catalog_attributes,
    requirement_designation = EXCLUDED.requirement_designation
WHERE courses.course_description LIKE '[SATISFI SYNTHETIC FIXTURE v1]%';

-- The ownership predicate above is evaluated while PostgreSQL holds the
-- conflicting row lock. This postcondition makes a skipped conflict fatal, so
-- even a non-fixture row inserted after the preflight check rolls back the
-- whole transaction instead of being overwritten or producing a partial seed.
DO $$
BEGIN
    IF (
        SELECT count(*)
        FROM public.courses
        WHERE course_id IN (
            'satisfi-synth-2027-csci-127',
            'satisfi-synth-2027-math-150',
            'satisfi-synth-2027-polsc-110'
        )
          AND course_description LIKE '[SATISFI SYNTHETIC FIXTURE v1]%'
    ) <> 3 THEN
        RAISE EXCEPTION 'synthetic course upsert did not acquire all 3 marker-owned rows; transaction will roll back';
    END IF;
END
$$;

INSERT INTO public.sections (
    class_num,
    course_id,
    term_season,
    term_year,
    section_number,
    section_component,
    group_code,
    instructor,
    instruction_mode,
    max_enrollment,
    enrollment,
    waitlist_max_enrollment,
    waitlist_count,
    enrollment_status,
    notes
)
VALUES
    (99027001, 'satisfi-synth-2027-csci-127', 'SPRING', 2027, 'S01', 'lecture', NULL,
     'Synthetic Instructor A', 'in_person', 30, 12, 0, 0, 'open',
     '[SATISFI SYNTHETIC FIXTURE v1] Open, in-person, multi-meeting example.'),
    (99027002, 'satisfi-synth-2027-csci-127', 'SPRING', 2027, 'S02', 'lecture', NULL,
     'Synthetic Instructor B', 'remote', 25, 25, 5, 0, 'closed',
     '[SATISFI SYNTHETIC FIXTURE v1] Full, synchronous remote example.'),
    (99027003, 'satisfi-synth-2027-math-150', 'SPRING', 2027, 'S01', 'lecture', NULL,
     'Synthetic Instructor C', 'hybrid', 30, 28, 5, 2, 'waitlist',
     '[SATISFI SYNTHETIC FIXTURE v1] Below-capacity waitlist and hybrid example.'),
    (99027004, 'satisfi-synth-2027-math-150', 'SPRING', 2027, 'S02', 'lecture', NULL,
     'Synthetic Instructor D', 'asynchronous', NULL, NULL, NULL, NULL, NULL,
     '[SATISFI SYNTHETIC FIXTURE v1] Unknown-capacity asynchronous example; no invented meeting.'),
    (99027005, 'satisfi-synth-2027-polsc-110', 'SPRING', 2027, 'S01', 'seminar', NULL,
     'Synthetic Instructor E', 'in_person', 20, 8, 0, 0, 'open',
     '[SATISFI SYNTHETIC FIXTURE v1] Saturday example.'),
    (99027006, 'satisfi-synth-2027-polsc-110', 'SPRING', 2027, 'S02', 'discussion', NULL,
     'Synthetic Instructor F', 'hybrid', 20, 10, 0, 0, 'open',
     '[SATISFI SYNTHETIC FIXTURE v1] Sunday example.')
ON CONFLICT (class_num, term_season, term_year) DO UPDATE SET
    course_id = EXCLUDED.course_id,
    section_number = EXCLUDED.section_number,
    section_component = EXCLUDED.section_component,
    group_code = EXCLUDED.group_code,
    instructor = EXCLUDED.instructor,
    instruction_mode = EXCLUDED.instruction_mode,
    max_enrollment = EXCLUDED.max_enrollment,
    enrollment = EXCLUDED.enrollment,
    waitlist_max_enrollment = EXCLUDED.waitlist_max_enrollment,
    waitlist_count = EXCLUDED.waitlist_count,
    enrollment_status = EXCLUDED.enrollment_status,
    notes = EXCLUDED.notes
WHERE sections.notes LIKE '[SATISFI SYNTHETIC FIXTURE v1]%';

DO $$
BEGIN
    IF (
        SELECT count(*)
        FROM (
            VALUES
                (99027001, 'satisfi-synth-2027-csci-127'),
                (99027002, 'satisfi-synth-2027-csci-127'),
                (99027003, 'satisfi-synth-2027-math-150'),
                (99027004, 'satisfi-synth-2027-math-150'),
                (99027005, 'satisfi-synth-2027-polsc-110'),
                (99027006, 'satisfi-synth-2027-polsc-110')
        ) AS expected(class_num, course_id)
        JOIN public.sections s
          ON s.class_num = expected.class_num
         AND s.course_id = expected.course_id
         AND s.term_season = 'SPRING'
         AND s.term_year = 2027
         AND s.notes LIKE '[SATISFI SYNTHETIC FIXTURE v1]%'
    ) <> 6 THEN
        RAISE EXCEPTION 'synthetic section upsert did not acquire all 6 marker-owned rows with expected course mappings; transaction will roll back';
    END IF;
END
$$;

-- Meeting rows have no natural-key constraint, so replace only rows owned by
-- the already collision-checked fixture sections.
DELETE FROM public.section_meetings sm
USING public.sections s
WHERE sm.section_id = s.section_id
  AND s.class_num BETWEEN 99027001 AND 99027006
  AND s.term_season = 'SPRING'
  AND s.term_year = 2027
  AND s.notes LIKE '[SATISFI SYNTHETIC FIXTURE v1]%';

INSERT INTO public.section_meetings (section_id, day_of_week, start_time, end_time, location)
SELECT s.section_id, fixture.day_of_week::weekday[], fixture.start_time, fixture.end_time, fixture.location
FROM (
    VALUES
        (99027001, ARRAY['Monday', 'Wednesday'], TIME '10:00', TIME '11:15', 'SYNTHETIC HN 1001'),
        (99027001, ARRAY['Friday'], TIME '10:00', TIME '10:50', 'SYNTHETIC HN 1001'),
        (99027002, ARRAY['Tuesday', 'Thursday'], TIME '13:00', TIME '14:15', 'SYNTHETIC ONLINE'),
        (99027003, ARRAY['Tuesday', 'Thursday'], TIME '09:30', TIME '10:45', 'SYNTHETIC HYBRID ROOM'),
        (99027005, ARRAY['Saturday'], TIME '09:00', TIME '11:30', 'SYNTHETIC HW 500'),
        (99027006, ARRAY['Sunday'], TIME '12:00', TIME '14:30', 'SYNTHETIC HYBRID ROOM')
) AS fixture(class_num, day_of_week, start_time, end_time, location)
JOIN public.sections s
  ON s.class_num = fixture.class_num
 AND s.term_season = 'SPRING'
 AND s.term_year = 2027;

COMMIT;

\echo 'Loaded 3 synthetic courses, 6 sections, and 6 meetings for Spring 2027.'
\echo 'These rows are development fixtures and make no academic-eligibility claims.'
