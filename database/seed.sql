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
  ('POLSC', 'Political Science')
  ON CONFLICT (dep_code) DO NOTHING;

INSERT INTO courses (course_id, dep_code, title, course_description, credits, prerequisites, corequisites, prerequisites_description, corequisites_description) VALUES
    ('CSCI 12700', 'CSCI', 'Introduction to Computer Science', '', 3.0, '{}', '{}', '', ''), -- CS Major Core
    ('CSCI 13500', 'CSCI', 'Software Analysis and Design I', '', 4.0, '{}', '{}', '', ''),
    ('CSCI 15000', 'CSCI', 'Discrete Structures', '', 4, '{}', '{}', '', ''),
    ('CSCI 23500', 'CSCI', 'Software Analysis and Design II', '', 3.0, '{}', '{}', '', ''), 
    ('CSCI 26500', 'CSCI', 'Computer Theory I', '', 3.0, '{}', '{}', '', ''),
    ('CSCI 16000', 'CSCI', 'Computer Architecture I', '', 3.0, '{}', '{}', '', ''),
    ('CSCI 26000', 'CSCI', 'Computer Architecture II', '', 3.0, '{}', '{}', '', ''),
    ('CSCI 33500', 'CSCI', 'Software Analysis and Design III', '', 3.0, '{}', '{}', '', ''),
    ('CSCI 34000', 'CSCI', 'Operating Systems', '', 3.0, '{}', '{}', '', ''),
    ('CSCI 49900', 'CSCI', 'Advnc Apl: Cpstne Maj', '', 4.0, '{}', '{}', '', ''),
    ('MATH 15000', 'MATH', 'Calculus I', '', 4.0, '{}', '{}', '', ''),
    ('MATH 15500', 'MATH', 'Calculus II', '', 4.0, '{}', '{}', '', ''),
    ('STAT 21300', 'STAT', 'Introduction to Applied Stat', '', 3.0, '{}', '{}', '', ''),
    ('CSCI 35000', 'CSCI', 'Artificial Intelligence', '', 3.0, '{}', '{}', '', ''),  -- CS Major Electives
    ('CSCI 35300', 'CSCI', 'Machine Learning', '', 3.0, '{}', '{}', '', ''),
    ('CSCI 36000', 'CSCI', 'Computer Architecture 3', '', 3.0, '{}', '{}', '', ''),
    ('CSCI 36500', 'CSCI', 'Computer Theory 2', '', 3.0, '{}', '{}', '', ''),
    ('CSCI 39100', 'CSCI', 'Independent Study in Computer Science', '', 1.0, '{}', '{}', '', ''),
    ('CSCI 39200', 'CSCI', 'Independent Study in Computer Science', '', 2.0, '{}', '{}', '', ''),
    ('CSCI 39300', 'CSCI', 'Independent Study in Computer Science', '', 3.0, '{}', '{}', '', ''),
    ('CSCI 39535', 'CSCI', 'UI/UX Design', '', 3.0, '{}', '{}', '', ''),
    ('CSCI 39536', 'CSCI', 'Intro to Robotics', '', 3.0, '{}', '{}', '', ''),
    ('CSCI 39540', 'CSCI', 'Flutter App Dev', '', 3.0, '{}', '{}', '', ''),
    ('CSCI 39541', 'CSCI', 'Basics of Game Engines', '', 3.0, '{}', '{}', '', ''),
    ('CSCI 39542', 'CSCI', 'Intro to Data Science', '', 3.0, '{}', '{}', '', ''),
    ('CSCI 39543', 'CSCI', 'Intro to Data Mining', '', 3.0, '{}', '{}', '', ''),
    ('CSCI 39544', 'CSCI', 'Digital Product Dev', '', 3.0, '{}', '{}', '', ''),
    ('CSCI 39548', 'CSCI', 'Practical Web Development', '', 3.0, '{}', '{}', '', ''),
    ('CSCI 39597', 'CSCI', 'iOS Development', '', 3.0, '{}', '{}', '', ''),
    ('CSCI 39598', 'CSCI', 'Intro to Cyber Risk', '', 3.0, '{}', '{}', '', ''),
    ('CSCI 40500', 'CSCI', 'Software Engineering', '', 3.0, '{}', '{}', '', ''),
    ('CSCI 43500', 'CSCI', 'Data Base Management', '', 3.0, '{}', '{}', '', ''),

    ('ENGL 12000', 'ENGL', 'Expository Writing', '', 3.0, '{}', '{}', '', ''), -- Mathematical and Quantitative Reasoning
    ('ENGL 22000', 'ENGL', 'Intro: Writing about Literature', '', 3.0, '{}', '{}', '', ''),   
    ('ENGL 220HS', 'ENGL', 'Intro to Literature', '', 3.0, '{}', '{}', '', ''),
    ('ASIAN 22100', 'ASIAN', 'Introduction to Writing About Asian American Literature', '', 3.0, '{}', '{}', '', ''),
    ('MEDIA 21100', 'MEDIA', 'News Literacy in a Digital Age', '', 3.0, '{}', '{}', '', ''),
    ('AFPRL 23800', 'AFPRL', 'Intro: Lit African Diaspora', '', 3.0, '{}', '{}', '', ''),
    ('CSCI 12100', 'CSCI', 'Computers & Money: Quant', '', 3.0, '{}', '{}', '', ''),
    ('ECO 22100', 'ECO', 'Economic Statistics', '', 3.0, '{}', '{}', '', ''),
    ('MATH 10000', 'MATH', 'Basic Structures in Math', '', 3.0, '{}', '{}', '', ''),
    ('MATH 10200', 'MATH', 'Math in Everyday Life', '', 3.0, '{}', '{}', '', ''),
    ('MATH 10400', 'MATH', 'Math for Elem Educ I', '', 3.0, '{}', '{}', '', ''),
    ('MATH 12400', 'MATH', 'College Algebra & Trig', '', 4.0, '{}', '{}', '', ''),
    ('MATH 12500', 'MATH', 'Precalculus', '', 4.0, '{}', '{}', '', ''),
    ('MATH 12550', 'MATH', 'Precalculus with Workshop', '', 4.0, '{}', '{}', '', ''),    
    ('MATH 15200', 'MATH', 'Calc for Life and Soc Science', '', 3.0, '{}', '{}', '', ''),
    ('STAT 11300', 'STAT', 'Elem Prob & Stat', '', 3.0, '{}', '{}', '', ''),
    ('STAT 21200', 'STAT', 'Discrete Probability', '', 3.0, '{}', '{}', '', ''),
    ('ANTHP 10100', 'ANTHP', 'Human Evolution', '', 3.0, '{}', '{}', '', ''), -- Scientific World
    ('ANTHP 10500', 'ANTHP', 'The Human Species', '', 3.0, '{}', '{}', '', ''),
    ('ASTRO 10200', 'ASTRO', 'Lab Explorations in Astronomy', '', 3.0, '{}', '{}', '', ''),
    ('BIOL 10000', 'BIOL', 'Principles of Biology I', '', 3.0, '{}', '{}', '', ''),
    ('BIOL 10500', 'BIOL', 'Introduction to Genome Biology', '', 3.0, '{}', '{}', '', ''),
    ('BIOL 10700', 'BIOL', 'Biology & Genetics of Personal Identification', '', 3.0, '{}', '{}', '', ''),
    ('BIOL 12500', 'BIOL', 'Human Biology', '', 3.0, '{}', '{}', '', ''),
    ('BIOL 15000', 'BIOL', 'CSI: Hunter (Forensic Biology)', '', 4.5, '{}', '{}', '', ''),
    ('CHEM 10100', 'CHEM', 'Inquiries Nature of Matter', '', 3.0, '{}', '{}', '', ''),
    ('CHEM 101HE', 'CHEM', 'Inquiries Nature of Matter (Honors)', '', 3.0, '{}', '{}', '', ''),
    ('CHEM 101LB', 'CHEM', 'Essentials of General Chemistry Lab', '', 3.0, '{}', '{}', '', ''),
    ('CHEM 10300', 'CHEM', 'General Chemistry I (Lab)', '', 3.0, '{}', '{}', '', ''),
    ('CHEM 103HE', 'CHEM', 'General Chemistry I (Lab) Honors', '', 3.0, '{}', '{}', '', ''),
    ('CHEM 10500', 'CHEM', 'General Chemistry II (Lab)', '', 3.0, '{}', '{}', '', ''),
    ('CHEM 10600', 'CHEM', 'General Chemistry Laboratory', '', 3.0, '{}', '{}', '', ''),
    ('CHEM 11100', 'CHEM', 'Chemical Principles', '', 3.0, '{}', '{}', '', ''),
    ('CHEM 12000', 'CHEM', 'Essentials of Organic Chemistry (Lecture)', '', 3.0, '{}', '{}', '', ''),
    ('CHEM 12100', 'CHEM', 'Essentials of Organic Chemistry (Lab)', '', 3.0, '{}', '{}', '', ''),
    ('GEOL 10100', 'GEOL', 'Introductory Geology Lab', '', 3.0, '{}', '{}', '', ''),
    ('POLSC 25000', 'POLSC', 'Comparing Countries', '', 3.0, '{}', '{}', '', ''), -- 
    ('FILM 10100', 'FILM', 'Introduction to Cinema', '', 3.0, '{}', '{}', '', ''),
    ('SOC 10100', 'SOC', 'Introduction to Sociology', '', 3.0, '{}', '{}', '', ''),
    ('ASIAN 21000', 'ASIAN', 'Asians in the United States', '', 3.0, '{}', '{}', '', ''),
    ('MEDIA 29853', 'MEDIA', 'Film Genre: Horror Film', '', 3.0, '{}', '{}', '', '');


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


INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 12700', req_id FROM course_requirements WHERE req_name IN ('CS Major Core', 'Scientific World');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 13500', req_id FROM course_requirements WHERE req_name IN ('CS Major Core');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 15000', req_id FROM course_requirements WHERE req_name IN ('CS Major Core');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 23500', req_id FROM course_requirements WHERE req_name IN ('CS Major Core');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 26500', req_id FROM course_requirements WHERE req_name IN ('CS Major Core');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 16000', req_id FROM course_requirements WHERE req_name IN ('CS Major Core');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 26000', req_id FROM course_requirements WHERE req_name IN ('CS Major Core');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 33500', req_id FROM course_requirements WHERE req_name IN ('CS Major Core');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 34000', req_id FROM course_requirements WHERE req_name IN ('CS Major Core');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 49900', req_id FROM course_requirements WHERE req_name IN ('CS Major Core');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 35000', req_id FROM course_requirements WHERE req_name IN ('CS Major Elective');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 35300', req_id FROM course_requirements WHERE req_name IN ('CS Major Elective');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 36000', req_id FROM course_requirements WHERE req_name IN ('CS Major Elective');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 36500', req_id FROM course_requirements WHERE req_name IN ('CS Major Elective');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 39100', req_id FROM course_requirements WHERE req_name IN ('CS Major Elective');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 39200', req_id FROM course_requirements WHERE req_name IN ('CS Major Elective');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 39300', req_id FROM course_requirements WHERE req_name IN ('CS Major Elective');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 39535', req_id FROM course_requirements WHERE req_name IN ('CS Major Elective');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 39536', req_id FROM course_requirements WHERE req_name IN ('CS Major Elective');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 39540', req_id FROM course_requirements WHERE req_name IN ('CS Major Elective');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 39541', req_id FROM course_requirements WHERE req_name IN ('CS Major Elective');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 39542', req_id FROM course_requirements WHERE req_name IN ('CS Major Elective');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 39543', req_id FROM course_requirements WHERE req_name IN ('CS Major Elective');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 39544', req_id FROM course_requirements WHERE req_name IN ('CS Major Elective');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 39548', req_id FROM course_requirements WHERE req_name IN ('CS Major Elective');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 39597', req_id FROM course_requirements WHERE req_name IN ('CS Major Elective');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 39598', req_id FROM course_requirements WHERE req_name IN ('CS Major Elective');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 40500', req_id FROM course_requirements WHERE req_name IN ('CS Major Elective');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 43500', req_id FROM course_requirements WHERE req_name IN ('CS Major Elective');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'MATH 15000', req_id FROM course_requirements WHERE req_name IN ('CS Major Core', 'Mathematical and Quantitative Reasoning');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'MATH 15500', req_id FROM course_requirements WHERE req_name IN ('CS Major Core', 'Mathematical and Quantitative Reasoning');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'STAT 21300', req_id FROM course_requirements WHERE req_name IN ('CS Major Core', 'Mathematical and Quantitative Reasoning');

INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'ENGL 12000', req_id FROM course_requirements WHERE req_name IN ('English Composition');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'ENGL 22000', req_id FROM course_requirements WHERE req_name IN ('English Composition');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'ENGL 220HS', req_id FROM course_requirements WHERE req_name IN ('English Composition');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'ASIAN 22100', req_id FROM course_requirements WHERE req_name IN ('English Composition', 'Writing Requirement');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'MEDIA 21100', req_id FROM course_requirements WHERE req_name IN ('English Composition', 'Writing Requirement');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'AFPRL 23800', req_id FROM course_requirements WHERE req_name IN ('English Composition');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'CSCI 12100', req_id FROM course_requirements WHERE req_name IN ('Mathematical and Quantitative Reasoning');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'ECO 22100', req_id FROM course_requirements WHERE req_name IN ('Mathematical and Quantitative Reasoning');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'MATH 10000', req_id FROM course_requirements WHERE req_name IN ('Mathematical and Quantitative Reasoning');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'MATH 10200', req_id FROM course_requirements WHERE req_name IN ('Mathematical and Quantitative Reasoning');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'MATH 10400', req_id FROM course_requirements WHERE req_name IN ('Mathematical and Quantitative Reasoning');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'MATH 12400', req_id FROM course_requirements WHERE req_name IN ('Mathematical and Quantitative Reasoning');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'MATH 12500', req_id FROM course_requirements WHERE req_name IN ('Mathematical and Quantitative Reasoning');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'MATH 12550', req_id FROM course_requirements WHERE req_name IN ('Mathematical and Quantitative Reasoning');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'MATH 15200', req_id FROM course_requirements WHERE req_name IN ('Mathematical and Quantitative Reasoning');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'STAT 11300', req_id FROM course_requirements WHERE req_name IN ('Mathematical and Quantitative Reasoning');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'STAT 21200', req_id FROM course_requirements WHERE req_name IN ('Mathematical and Quantitative Reasoning');

INSERT INTO course_requirements_map (course_id, req_id)
SELECT c.course_id, t.req_id
FROM courses c
JOIN course_requirements t ON t.req_name = 'Life & Physical Sciences'
WHERE c.course_id IN (
  'ANTHP 10100',
  'ANTHP 10500',
  'ASTRO 10200',
  'BIOL 10000',
  'BIOL 10500',
  'BIOL 10700',
  'BIOL 12500',
  'BIOL 15000',
  'CHEM 10100',
  'CHEM 101HE',
  'CHEM 101LB',
  'CHEM 10300',
  'CHEM 103HE',
  'CHEM 10500',
  'CHEM 10600',
  'CHEM 11100',
  'CHEM 12000',
  'CHEM 12100',
  'GEOL 10100'
)
ON CONFLICT DO NOTHING;

INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'POLSC 25000', req_id FROM course_requirements WHERE req_name IN ('World Cultures and Global Issues', 'Pluralism & Diversity Group A: Non-European Societies');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'FILM 10100', req_id FROM course_requirements WHERE req_name IN ('Creative Expression');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'SOC 10100', req_id FROM course_requirements WHERE req_name IN ('Individual and Society - Social Science');
INSERT INTO course_requirements_map (course_id, req_id)
SELECT 'ASIAN 21000', req_id FROM course_requirements WHERE req_name IN ('Individual and Society - Humanities, Cultures and Ideas', 'Pluralism & Diversity Group B: Groups in the U.S.A.');

