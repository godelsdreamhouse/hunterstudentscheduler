-- https://hunter-undergraduate.catalog.cuny.edu/policies-and-requirements/academic-requirements/general-requirements/general-education-common-core

DROP TABLE IF EXISTS section_meetings CASCADE;
DROP TABLE IF EXISTS sections CASCADE;
DROP TABLE IF EXISTS course_requirements_map CASCADE;
DROP TABLE IF EXISTS course_requirements CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS departments CASCADE;

DROP TYPE IF EXISTS weekday CASCADE;
DROP TYPE IF EXISTS component CASCADE;
DROP TYPE IF EXISTS status CASCADE;
DROP TYPE IF EXISTS modality CASCADE;


CREATE TYPE weekday AS ENUM ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun');
CREATE TYPE component AS ENUM ('lecture', 'lab', 'recitation', 'discussion', 'seminar', 'workshop');
CREATE TYPE status AS ENUM ('open', 'closed', 'waitlist');
CREATE TYPE modality AS ENUM ('in_person', 'hybrid', 'asynchronous');

CREATE TABLE departments (
  dep_code TEXT PRIMARY KEY,
  name   TEXT NOT NULL
);

CREATE TABLE courses (
    course_id TEXT PRIMARY KEY,
    dep_code TEXT NOT NULL REFERENCES departments(dep_code),
    title TEXT NOT NULL,
    description TEXT, 
    credits NUMERIC(3,1) NOT NULL DEFAULT 3.0
); 

-- Requirement types (as of 02/09):
-- CS Major Core, CS Major Elective, Scientific World, Mathematical and Quantitative Reasoning, English Composition,
-- Life & Physical Sciences, Creative Expression, U.S. Experiences in its Diversity
-- World Cultures and Global Issues, Individual and Society - Social Science, 
-- Individual and Society - Humanities, Cultures and Ideas, Writing Requirement,
-- Pluralism & Diversity Group A: Non-European Societies, Pluralism & Diversity Group B: Groups in the U.S.A.
-- Pluralism & Diversity Group C: Women, Gender & Sexual Orientation, Pluralism & Diversity Group D: European Societies
CREATE TABLE course_requirements (
    req_id   BIGSERIAL PRIMARY KEY,
    req_name TEXT NOT NULL UNIQUE
);

CREATE TABLE course_requirements_map (
    course_id TEXT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    req_id    BIGINT NOT NULL REFERENCES course_requirements(req_id) ON DELETE CASCADE,
    PRIMARY KEY (course_id, req_id)
);

CREATE TABLE sections (
    section_id BIGSERIAL PRIMARY KEY,
    course_id TEXT NOT NULL REFERENCES courses(course_id) ON DELETE CASCADE,
    term_season TEXT NOT NULL CHECK (term_season IN ('SPRING', 'SUMMER', 'FALL', 'WINTER')),
    term_year INT NOT NULL CHECK (term_year >= 2000 AND term_year <= 2100),
    section_code TEXT NOT NULL,                  -- e.g. 01, 02, L1
    section_component component NOT NULL DEFAULT 'lecture',
    group_code TEXT,                             -- e.g. G1, G2, G3; NULL if standalone
    instructor TEXT,
    instruction_mode modality NOT NULL DEFAULT 'in_person',
    
    capacity INT CHECK (capacity >= 0),
    enrolled INT DEFAULT 0 CHECK (enrolled >= 0),
    waitlist_capacity INT DEFAULT 0 CHECK (waitlist_capacity >= 0),
    waitlist_count INT DEFAULT 0 CHECK (waitlist_count >= 0),
    enrollment_status status,

    notes TEXT, -- useful for sections exclusive to honors students

    CHECK (enrolled <= capacity),
    CHECK (waitlist_count <= waitlist_capacity)
);

CREATE UNIQUE INDEX uniq_sections_standalone
ON sections (course_id, term_season, term_year, section_code, section_component)
WHERE group_code IS NULL;

CREATE UNIQUE INDEX uniq_sections_grouped
ON sections (course_id, term_season, term_year, section_code, section_component, group_code)
WHERE group_code IS NOT NULL;

CREATE TABLE section_meetings (
    meeting_id BIGSERIAL PRIMARY KEY,
    section_id BIGINT NOT NULL REFERENCES sections(section_id) ON DELETE CASCADE,
    day_of_week weekday NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    building TEXT,
    room TEXT,
    CHECK (end_time > start_time)
);
