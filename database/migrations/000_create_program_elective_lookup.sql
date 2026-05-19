-- Creates the program elective lookup objects used by backend /api/courses/electives.

ALTER TABLE programs
ADD COLUMN IF NOT EXISTS program_key TEXT,
ADD COLUMN IF NOT EXISTS dep_code TEXT,
ADD COLUMN IF NOT EXISTS program_core_reqs TEXT[] DEFAULT '{}';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'programs'
          AND column_name = 'total_credits_required'
    ) THEN
        ALTER TABLE programs
        ALTER COLUMN total_credits_required SET DEFAULT 0;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_programs_program_key
ON programs(program_key);

CREATE TABLE IF NOT EXISTS program_elective_rules (
    rule_id BIGSERIAL PRIMARY KEY,
    program_id BIGINT NOT NULL REFERENCES programs(program_id) ON DELETE CASCADE,
    dep_code TEXT NOT NULL REFERENCES departments(dep_code),
    operator TEXT NOT NULL CHECK (operator IN ('>', 'prefix')),
    min_catalog_number INT,
    catalog_number_prefix TEXT,
    rule_group INT DEFAULT 1,

    CHECK (
        (
            operator = '>'
            AND min_catalog_number IS NOT NULL
            AND catalog_number_prefix IS NULL
        )
        OR
        (
            operator = 'prefix'
            AND catalog_number_prefix IS NOT NULL
            AND min_catalog_number IS NULL
        )
    )
);

CREATE TABLE IF NOT EXISTS program_elective_exclusions (
    exclusion_id BIGSERIAL PRIMARY KEY,
    program_id BIGINT NOT NULL REFERENCES programs(program_id) ON DELETE CASCADE,
    course_code TEXT NOT NULL,
    UNIQUE (program_id, course_code)
);

CREATE MATERIALIZED VIEW IF NOT EXISTS program_elective_courses AS
SELECT DISTINCT
    p.program_key,
    c.course_code
FROM programs p
JOIN program_elective_rules r
    ON r.program_id = p.program_id
JOIN courses c
    ON c.dep_code = r.dep_code
WHERE c.is_active = TRUE
  AND p.program_key IS NOT NULL
  AND (
      (
          r.operator = '>'
          AND NULLIF(regexp_replace(c.course_code, '\D', '', 'g'), '')::INT > r.min_catalog_number
      )
      OR
      (
          r.operator = 'prefix'
          AND NULLIF(regexp_replace(c.course_code, '\D', '', 'g'), '') LIKE r.catalog_number_prefix || '%'
      )
  )
  AND NOT EXISTS (
      SELECT 1
      FROM program_elective_exclusions e
      WHERE e.program_id = p.program_id
        AND e.course_code = c.course_code
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_program_elective_courses_unique
ON program_elective_courses(program_key, course_code);
