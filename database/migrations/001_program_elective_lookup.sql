-- Creates the program elective lookup objects used by backend /api/courses/electives.
-- Seed supported programs and their elective rules based on:
-- put("ComputerScience_ComputerScience", new String[] {"CSCI >13600", "CSCI 49600, 49700, 49800, 49900, 12000, 12100, 13200, 13300, 18100, 18200, 18300, 22700, 23200, 23300"});
-- put("Mathematics_Mathematics", new String[] {"MATH 3@ or MATH 4@ or STAT 3@ or STAT 4@", ""});
-- put("PoliticalScience_None", new String[] {"POLSC 4@ or POLSC 3@ or POLSC 2@ or POLSC 1@", ""});

ALTER TABLE programs
ADD COLUMN IF NOT EXISTS program_key TEXT;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'programs'
          AND column_name = 'department_code'
    )
    AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'programs'
          AND column_name = 'dep_code'
    ) THEN
        ALTER TABLE programs
        RENAME COLUMN department_code TO dep_code;
    END IF;
END $$;

ALTER TABLE programs
ADD COLUMN IF NOT EXISTS dep_code TEXT REFERENCES departments(dep_code);

ALTER TABLE programs
DROP COLUMN IF EXISTS program_requirements;

ALTER TABLE programs
DROP COLUMN IF EXISTS program_core_reqs;

ALTER TABLE programs
DROP COLUMN IF EXISTS total_credits_required;

ALTER TABLE programs
DROP COLUMN IF EXISTS elective_count_required;

ALTER TABLE programs
DROP COLUMN IF EXISTS elective_credits_required;

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

INSERT INTO programs (
    program_key,
    program_name,
    dep_code
)
VALUES
    ('ComputerScience_ComputerScience', 'Computer Science Major', 'CSCI'),
    ('Mathematics_Mathematics', 'Mathematics Major', 'MATH'),
    ('PoliticalScience_None', 'Political Science Major', 'POLSC')
ON CONFLICT (program_key) DO UPDATE
SET
    program_name = EXCLUDED.program_name,
    dep_code = EXCLUDED.dep_code;

-- Replace rules for these seeded programs only.
DELETE FROM program_elective_rules
WHERE program_id IN (
    SELECT program_id
    FROM programs
    WHERE program_key IN (
        'ComputerScience_ComputerScience',
        'Mathematics_Mathematics',
        'PoliticalScience_None'
    )
);

INSERT INTO program_elective_rules (
    program_id,
    dep_code,
    operator,
    min_catalog_number
)
SELECT program_id, 'CSCI', '>', 13600
FROM programs
WHERE program_key = 'ComputerScience_ComputerScience';

INSERT INTO program_elective_rules (
    program_id,
    dep_code,
    operator,
    catalog_number_prefix
)
SELECT p.program_id, r.dep_code, 'prefix', r.catalog_number_prefix
FROM programs p
JOIN (
    VALUES
        ('MATH', '3'),
        ('MATH', '4'),
        ('STAT', '3'),
        ('STAT', '4')
) AS r(dep_code, catalog_number_prefix)
    ON p.program_key = 'Mathematics_Mathematics';

INSERT INTO program_elective_rules (
    program_id,
    dep_code,
    operator,
    catalog_number_prefix
)
SELECT p.program_id, r.dep_code, 'prefix', r.catalog_number_prefix
FROM programs p
JOIN (
    VALUES
        ('POLSC', '4'),
        ('POLSC', '3'),
        ('POLSC', '2'),
        ('POLSC', '1')
) AS r(dep_code, catalog_number_prefix)
    ON p.program_key = 'PoliticalScience_None';

-- Replace Computer Science exclusions.
DELETE FROM program_elective_exclusions
WHERE program_id IN (
    SELECT program_id
    FROM programs
    WHERE program_key = 'ComputerScience_ComputerScience'
);

INSERT INTO program_elective_exclusions (program_id, course_code)
SELECT p.program_id, e.course_code
FROM programs p
JOIN (
    VALUES
        ('CSCI 49600'),
        ('CSCI 49700'),
        ('CSCI 49800'),
        ('CSCI 49900'),
        ('CSCI 12000'),
        ('CSCI 12100'),
        ('CSCI 13200'),
        ('CSCI 13300'),
        ('CSCI 13500'),
        ('CSCI 15000'),
        ('CSCI 16000'),
        ('CSCI 18100'),
        ('CSCI 18200'),
        ('CSCI 18300'),
        ('CSCI 22700'),
        ('CSCI 23200'),
        ('CSCI 23300'),
        ('CSCI 23500'),
        ('CSCI 26000'),
        ('CSCI 26500'),
        ('CSCI 33500'),
        ('CSCI 34000')
) AS e(course_code)
    ON p.program_key = 'ComputerScience_ComputerScience'
ON CONFLICT (program_id, course_code) DO NOTHING;

DROP MATERIALIZED VIEW IF EXISTS program_elective_courses;

CREATE MATERIALIZED VIEW program_elective_courses AS
SELECT DISTINCT
    p.program_key,
    c.course_code
FROM programs p
JOIN program_elective_rules r
    ON r.program_id = p.program_id
JOIN courses c
    ON c.dep_code = r.dep_code
WHERE c.is_active = TRUE
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

CREATE UNIQUE INDEX idx_program_elective_courses_unique
ON program_elective_courses(program_key, course_code);
