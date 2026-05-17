DROP MATERIALIZED VIEW IF EXISTS program_elective_courses;
DROP TABLE IF EXISTS section_meetings CASCADE;
DROP TABLE IF EXISTS sections CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS program_elective_exclusions CASCADE;
DROP TABLE IF EXISTS program_elective_rules CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS user_schedules CASCADE;
DROP TABLE IF EXISTS programs CASCADE;
DROP TABLE IF EXISTS studentProfiles CASCADE;
DROP TABLE IF EXISTS user_unavailable_times CASCADE;
DROP TYPE IF EXISTS weekday CASCADE;
DROP TYPE IF EXISTS component CASCADE;
DROP TYPE IF EXISTS status CASCADE;
DROP TYPE IF EXISTS modality CASCADE;


CREATE TYPE weekday AS ENUM ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
CREATE TYPE component AS ENUM ('lecture', 'lab', 'recitation', 'discussion', 'seminar', 'workshop');
CREATE TYPE status AS ENUM ('open', 'closed', 'waitlist');
CREATE TYPE modality AS ENUM ('in_person', 'hybrid', 'asynchronous', 'remote');

CREATE TABLE departments (
  dep_code TEXT PRIMARY KEY,
  dep_name   TEXT NOT NULL
);

CREATE TABLE courses (
    course_id TEXT NOT NULL PRIMARY KEY,        -- maps to courseGroupId for scraper 
    course_code TEXT NOT NULL,              -- e.g. 'CSCI 127000 
    course_name TEXT NOT NULL,             -- e.g. 'Introduction to Computer Science'
    dep_code TEXT NOT NULL REFERENCES departments(dep_code), -- e.g. 'CSCI'
    course_description TEXT, 
    credits INT NOT NULL DEFAULT 3,
    prerequisites TEXT[] DEFAULT '{}',           
    corequisites TEXT[] DEFAULT '{}',            
    prerequisites_notes TEXT,                    -- e.g. Department Permission
    corequisites_notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,           -- whether courses has sections in current term
    last_updated DATE,
    catalog_attributes TEXT[] DEFAULT '{}',
    requirement_designation TEXT
); 

CREATE INDEX idx_courses_active ON courses(course_id) WHERE is_active = TRUE; -- index for active courses

CREATE TABLE sections (
    section_id BIGSERIAL PRIMARY KEY,
    class_num INT NOT NULL,
    course_id TEXT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    term_season TEXT NOT NULL CHECK (term_season IN ('SPRING', 'SUMMER', 'FALL', 'WINTER')),
    term_year INT NOT NULL CHECK (term_year >= 2000 AND term_year <= 2100),
    section_number TEXT NOT NULL,                  -- e.g. 01, 02, L1
    section_component component NOT NULL DEFAULT 'lecture',
    group_code TEXT,                             -- e.g. G1, G2, G3; NULL if standalone
    instructor TEXT,
    instruction_mode modality NOT NULL DEFAULT 'in_person',
    
    max_enrollment INT CHECK (max_enrollment >= 0),
    enrollment INT DEFAULT 0 CHECK (enrollment >= 0),
    waitlist_max_enrollment INT DEFAULT 0 CHECK (waitlist_max_enrollment >= 0),
    waitlist_count INT DEFAULT 0 CHECK (waitlist_count >= 0),
    enrollment_status status,

    notes TEXT, -- useful for sections exclusive to honors students

    CHECK (waitlist_count <= waitlist_max_enrollment),
    UNIQUE (class_num, term_season, term_year)
);

CREATE UNIQUE INDEX uniq_sections_standalone
ON sections (course_id, term_season, term_year, section_number, section_component)
WHERE group_code IS NULL;

CREATE UNIQUE INDEX uniq_sections_grouped
ON sections (course_id, term_season, term_year, section_number, section_component, group_code)
WHERE group_code IS NOT NULL;

CREATE TABLE section_meetings (
    meeting_id BIGSERIAL PRIMARY KEY,
    section_id BIGINT NOT NULL REFERENCES sections(section_id) ON DELETE CASCADE,
    day_of_week weekday[] NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    location TEXT, -- e.g. HN-531
    CHECK (end_time > start_time)
);

CREATE TABLE users (
    emplid INT NOT NULL PRIMARY KEY,
    email TEXT UNIQUE, 
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    preferences TEXT[],
    password TEXT NOT NULL,
    courses_taken INT[] DEFAULT '{}', -- references courses(course_id)
    programs TEXT[] DEFAULT '{}' -- e.g. 'Computer Science Major', 'Mathematics Minor'
);

CREATE TABLE user_schedules (
    schedule_id BIGSERIAL PRIMARY KEY,
    emplid INT NOT NULL REFERENCES users(emplid) ON DELETE CASCADE,
    score INT NOT NULL,
    favorited BOOLEAN NOT NULL DEFAULT FALSE,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 'Computer Science Major', 'Mathematics Major', 'Political Science Major', 
CREATE TABLE programs (
    program_id BIGSERIAL PRIMARY KEY,
    program_key TEXT UNIQUE NOT NULL,       -- e.g. ComputerScience_ComputerScience
    program_name TEXT NOT NULL,          -- e.g., 'Computer Science Major'
    dep_code TEXT REFERENCES departments(dep_code),
    program_core_reqs TEXT[]  -- e.g. CSCI 16000
);

CREATE TABLE program_elective_rules (
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

CREATE TABLE program_elective_exclusions (
    exclusion_id BIGSERIAL PRIMARY KEY,
    program_id BIGINT NOT NULL REFERENCES programs(program_id) ON DELETE CASCADE,
    course_code TEXT NOT NULL,
    UNIQUE (program_id, course_code)
);

CREATE TABLE studentProfiles (
    profile_id BIGSERIAL PRIMARY KEY,
    emplid INT NOT NULL REFERENCES users(emplid) ON DELETE CASCADE,
    enrolled_programs TEXT[] DEFAULT '{}',
    courses_taken INT[], -- references courses(course_id)
    requirements_needed TEXT[],
    requirements_fulfilled TEXT[],
    -- hard constraints
    credit_lower_bound FLOAT DEFAULT 0.5,  -- credit bounds must be divisible by 0.5
    credit_upper_bound FLOAT DEFAULT 17.5,
    unavailable INT[] DEFAULT '{}', -- references user_unavailable_times(unavailable_time_id)
    -- soft constraints
    morning BOOLEAN DEFAULT FALSE,
    afternoon BOOLEAN DEFAULT FALSE,
    evening BOOLEAN DEFAULT FALSE,
    less_gaps BOOLEAN DEFAULT FALSE,
    less_days BOOLEAN DEFAULT FALSE,
    in_person BOOLEAN DEFAULT FALSE,

    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_unavailable_times (
    unavailable_time_id BIGSERIAL PRIMARY KEY,
    emplid INT NOT NULL REFERENCES users(emplid) ON DELETE CASCADE,
    day_of_week weekday NOT NULL,
    start_time INT NOT NULL,
    end_time INT NOT NULL,
    CHECK (end_time > start_time)
);

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
