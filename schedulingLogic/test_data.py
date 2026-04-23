import models

def cid(subj: str, num: int) -> tuple[str, int]:
    return (subj, num)

def m(day: models.Day, h1: int, min1: int, h2: int, min2: int) -> models.Meeting:
    return models.Meeting(day=day, start_time=h1 * 60 + min1, end_time=h2 * 60 + min2)

# Courses
csci_12700 = models.Course("CSCI", 12700, "Introduction to Computer Science", {"Computer Science"}, models.AcademicCareer.UNDERGRADUATE, 3, "Intro CS")
csci_13500 = models.Course("CSCI", 13500, "Software Analysis and Design 1", {"Computer Science"}, models.AcademicCareer.UNDERGRADUATE, 3, "SAD 1", prereqs={cid("CSCI", 12700)})
csci_15000 = models.Course("CSCI", 15000, "Discrete Structures", {"Computer Science"}, models.AcademicCareer.UNDERGRADUATE, 3, "Discrete Structures")
math_16000 = models.Course("MATH", 16000, "Matrix Algebra", {"Mathematics"}, models.AcademicCareer.UNDERGRADUATE, 3, "Matrix Algebra")
csci_16000 = models.Course("CSCI", 16000, "Computer Architecture 1", {"Computer Science"}, models.AcademicCareer.UNDERGRADUATE, 3, "Comp Arch 1", prereqs={cid("CSCI", 15000)})
stat_21300 = models.Course("STAT", 21300, "Introduction to Applied Statistics", {"Statistics"}, models.AcademicCareer.UNDERGRADUATE, 3, "Applied Stats")
csci_23500 = models.Course("CSCI", 23500, "Software Analysis and Design 2", {"Computer Science"}, models.AcademicCareer.UNDERGRADUATE, 3, "SAD 2", prereqs={cid("CSCI", 13500)})
csci_26000 = models.Course("CSCI", 26000, "Computer Architecture 2", {"Computer Science"}, models.AcademicCareer.UNDERGRADUATE, 3, "Comp Arch 2", prereqs={cid("CSCI", 16000)})
csci_26500 = models.Course("CSCI", 26500, "Computer Theory 1", {"Computer Science"}, models.AcademicCareer.UNDERGRADUATE, 3, "Theory 1")
csci_33500 = models.Course("CSCI", 33500, "Software Analysis and Design 3", {"Computer Science"}, models.AcademicCareer.UNDERGRADUATE, 3, "SAD 3", prereqs={cid("CSCI", 23500)})
csci_34000 = models.Course("CSCI", 34000, "Operating Systems", {"Computer Science"}, models.AcademicCareer.UNDERGRADUATE, 3, "Operating Systems", prereqs={cid("CSCI", 26000), cid("CSCI", 33500)})
csci_49900 = models.Course("CSCI", 49900, "Advanced Applications: A Capstone for Majors", {"Computer Science"}, models.AcademicCareer.UNDERGRADUATE, 3, "Capstone", prereqs={cid("CSCI", 34000)})

cs_major = models.Major(
    nysed_code=2354,
    concentration_code="",
    dept="Computer Science",
    credits_required=28,
    description="Computer Science Concentration",
    required_courses={
        cid("CSCI", 12700), cid("CSCI", 13500), cid("CSCI", 15000), cid("MATH", 16000),
        cid("CSCI", 16000), cid("STAT", 21300), cid("CSCI", 23500), cid("CSCI", 26000),
        cid("CSCI", 26500), cid("CSCI", 33500), cid("CSCI", 34000), cid("CSCI", 49900),
    },
)

student = models.StudentProfile(
    emplid=23942520,
    student_program=models.StudentProgram(majors=[cs_major]),
    preferences=models.Prefrences(
        credit_lower_bound=12.0,
        credit_upper_bound=16.0,
        unavailable=[m(models.Day.MONDAY, 12, 0, 13, 30)],
        morning=True,
        in_person=True,
    ),
    classes_taken={models.CourseId("CSCI", 12700), models.CourseId("CSCI", 15000)},
    classes_needed={models.CourseId("CSCI", 13500), models.CourseId("MATH", 16000), models.CourseId("STAT", 21300)},
)

sections = [
    models.Section(csci_13500, "01", 100001, models.Modality.INPERSON, 28, 35, [m(models.Day.MONDAY, 9, 0, 10, 15), m(models.Day.WEDNESDAY, 9, 0, 10, 15)], "Prof A"),
    models.Section(csci_13500, "02", 100002, models.Modality.REMOTE, 33, 35, [m(models.Day.TUESDAY, 18, 0, 19, 15), m(models.Day.THURSDAY, 18, 0, 19, 15)], "Prof B"),
    models.Section(math_16000, "01", 100101, models.Modality.INPERSON, 25, 30, [m(models.Day.MONDAY, 11, 0, 12, 15), m(models.Day.WEDNESDAY, 11, 0, 12, 15)], "Prof C"),
    models.Section(stat_21300, "01", 100201, models.Modality.INPERSON, 20, 30, [m(models.Day.TUESDAY, 14, 0, 15, 15), m(models.Day.THURSDAY, 14, 0, 15, 15)], "Prof D"),
]

# test_data.py
import models

def clone_course(c: models.Course, catalog_offset: int, title_suffix: str) -> models.Course:
    return models.Course(
        subject_area=c.subject_area,
        catalog_number=c.catalog_number + catalog_offset,  # unique ID
        course_title=f"{c.course_title} {title_suffix}",
        departments=set(c.departments),
        academic_career=c.academic_career,
        credits=c.credits,
        description=c.description,
        fulfills=set(c.fulfills),
        prereqs=set(),   # keep empty for stress test
        coreqs=set(),
    )

def clone_section(
    s: models.Section,
    new_course: models.Course,
    class_num_offset: int,
    section_suffix: str,
    minute_shift: int = 0,
) -> models.Section:
    shifted_meetings = [
        models.Meeting(
            day=m.day,
            start_time=m.start_time + minute_shift,
            end_time=m.end_time + minute_shift,
        )
        for m in s.meetings
    ]
    return models.Section(
        course=new_course,
        section_code=f"{s.section_code}{section_suffix}",
        class_num=s.class_num + class_num_offset,  # must be unique
        instruction_modality=s.instruction_modality,
        enrollement_total=s.enrollement_total,
        class_capacity=s.class_capacity,
        instructor=s.instructor,
        meetings=shifted_meetings,
    )

def make_scaled_sections(base_sections: list[models.Section], copies: int = 50) -> list[models.Section]:
    out = list(base_sections)
    for i in range(1, copies + 1):
        for j, s in enumerate(base_sections):
            new_course = clone_course(s.course, catalog_offset=i * 100 + j, title_suffix=f"(X{i})")
            # shift time slightly so not all identical
            minute_shift = (i % 4) * 15
            out.append(
                clone_section(
                    s=s,
                    new_course=new_course,
                    class_num_offset=i * 100000 + j * 1000,
                    section_suffix=f"X{i}",
                    minute_shift=minute_shift,
                )
            )
    return out
