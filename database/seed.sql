-- Example seed data for departments, courses, course requirements, and programs. This is not meant to be exhaustive, but rather to provide a starting point for testing and development.

INSERT INTO departments (dep_code, dep_name) VALUES -- might be useful if we want the user to add wants after the needs are satisfied
  ('CSCI', 'Computer Science'),
  ('MATH', 'Mathematics'),
  ('STAT', 'Statistics'),
  ('ENGL', 'English'),
  ('MEDIA', 'Media Studies'),
  ('ECO', 'Economics'),
  ('FILM', 'Film & Cinema Studies'),
  ('SOC', 'Sociology'),
  ('ASIAN', 'Asian American Studies'),
  ('ANTHP', 'Anthropology'),
  ('ASTRO', 'Astronomy'),
  ('BIOL', 'Biology'),
  ('CHEM', 'Chemistry'),
  ('GEOL', 'Geology'),
  ('AFPRL', 'Africana, Puerto Rican and Latino Studies'),
  ('POLSCI', 'Political Science')
  ON CONFLICT (dep_code) DO NOTHING;

-- INSERT INTO courses (course_id, course_short_name, course_long_name, course_code, dep_code, course_description, credits, prerequisites, corequisites, prerequisites_notes, corequisites_notes, is_active) VALUES
--     (1, 'CSCI 12700', 'Introduction to Computer Science', 'CSCI', 'CSCI', 3.0, '{}', '{}', '', ''), 
--     (2, 'CSCI 13500', 'Software Analysis and Design I', 'CSCI', 'CSCI', 4.0, '{}', '{}', '', ''),
--     (3, 'CSCI 15000', 'Discrete Structures', 'CSCI', 'CSCI', 4.0, '{}', '{}', '', '')
-- ON CONFLICT (course_id) DO NOTHING;

INSERT INTO course_requirements (req_name) VALUES 
    ('CS Major Core'),
    ('CS Major Elective'), 
    ('Scientific World'), 
    ('Mathematical and Quantitative Reasoning'), 
    ('English Composition'),
    ('Life & Physical Sciences'),
    ('Creative Expression'),
    ('U.S. Experiences in its Diversity'),
    ('World Cultures and Global Issues'),  
    ('Individual and Society - Social Science'),
    ('Individual and Society - Humanities, Cultures and Ideas'), 
    ('Writing Requirement'),
    ('Pluralism & Diversity Group A: Non-European Societies'), 
    ('Pluralism & Diversity Group B: Groups in the U.S.A.'),
    ('Pluralism & Diversity Group C: Women, Gender & Sexual Orientation'), 
    ('Pluralism & Diversity Group D: European Societies')
ON CONFLICT (req_name) DO NOTHING;

-- INSERT INTO programs (program_name, department_code, program_requirements, total_credits_required, elective_count_required) VALUES
--     ('Computer Science Major', 'CSCI', ARRAY['CS Major Core', 'CS Major Elective'], 120, 12);