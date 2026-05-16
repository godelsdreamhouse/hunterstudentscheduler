import models


def cid(subj: str, num: int) -> models.CourseId:
    return models.CourseId(subject_area=subj, catalog_number=num)


def m(day: models.Day, h1: int, min1: int, h2: int, min2: int) -> models.Meeting:
    return models.Meeting(day=day, start_time=h1 * 60 + min1, end_time=h2 * 60 + min2)


def make_course(
    subj: str,
    num: int,
    title: str,
    departments: list[str],
    credits: int = 3,
    description: str = "",
    tags: set[str] | None = None,
    prereqs: list[models.CourseId] | None = None,
) -> models.Course:
    return models.Course(
        course_id=cid(subj, num),
        course_title=title,
        departments=departments,
        academic_career=models.AcademicCareer.UNDERGRADUATE,
        credits=credits,
        description=description,
        tags=tags or set(),
        prereqs=prereqs or [],
    )


# Courses
csci_12700 = make_course(
    "CSCI",
    12700,
    "Introduction to Computer Science",
    ["Computer Science"],
    description="Intro CS",
)
csci_13500 = make_course(
    "CSCI",
    13500,
    "Software Analysis and Design 1",
    ["Computer Science"],
    description="SAD 1",
    prereqs=[cid("CSCI", 12700)],
)
math_16000 = make_course(
    "MATH",
    16000,
    "Matrix Algebra",
    ["Mathematics"],
    description="Matrix Algebra",
)
stat_21300 = make_course(
    "STAT",
    21300,
    "Introduction to Applied Statistics",
    ["Statistics"],
    description="Applied Stats",
)


student = models.StudentProfile(
    emplid=23942520,
    student_program=models.StudentProgram(majors=[models.Major.CS]),
    preferences=models.Prefrences(
        credit_lower_bound=12.0,
        credit_upper_bound=16.0,
        unavailable=[m(models.Day.MONDAY, 12, 0, 13, 30)],
        morning=True,
        in_person=True,
    ),
    classes_taken={cid("CSCI", 12700)},
    requirements_needed=[
        models.Requirement(
            name="SAD 1",
            attribute="CS Major Core",
            fulfilled_by=[csci_13500],
        ),
        models.Requirement(
            name="Matrix Algebra",
            attribute="Mathematical and Quantitative Reasoning",
            fulfilled_by=[math_16000],
        ),
        models.Requirement(
            name="Applied Statistics",
            attribute="CS Major Core",
            fulfilled_by=[stat_21300],
        ),
    ],
    elective_prefrences={cid("CSCI", 13500)},
)


sections = [
    models.Section(
        course=csci_13500,
        class_num=100001,
        section_code="01",
        instruction_modality=models.Modality.INPERSON,
        enrollement_total=28,
        class_capacity=35,
        meetings=[
            m(models.Day.MONDAY, 9, 0, 10, 15),
            m(models.Day.WEDNESDAY, 9, 0, 10, 15),
        ],
        instructor="Prof A",
    ),
    models.Section(
        course=csci_13500,
        class_num=100002,
        section_code="02",
        instruction_modality=models.Modality.REMOTE,
        enrollement_total=33,
        class_capacity=35,
        meetings=[
            m(models.Day.TUESDAY, 18, 0, 19, 15),
            m(models.Day.THURSDAY, 18, 0, 19, 15),
        ],
        instructor="Prof B",
    ),
    models.Section(
        course=math_16000,
        class_num=100101,
        section_code="01",
        instruction_modality=models.Modality.INPERSON,
        enrollement_total=25,
        class_capacity=30,
        meetings=[
            m(models.Day.MONDAY, 11, 0, 12, 15),
            m(models.Day.WEDNESDAY, 11, 0, 12, 15),
        ],
        instructor="Prof C",
    ),
    models.Section(
        course=stat_21300,
        class_num=100201,
        section_code="01",
        instruction_modality=models.Modality.INPERSON,
        enrollement_total=20,
        class_capacity=30,
        meetings=[
            m(models.Day.TUESDAY, 14, 0, 15, 15),
            m(models.Day.THURSDAY, 14, 0, 15, 15),
        ],
        instructor="Prof D",
    ),
]


def clone_course(c: models.Course, catalog_offset: int, title_suffix: str) -> models.Course:
    return models.Course(
        course_id=cid(c.course_id.subject_area, c.course_id.catalog_number + catalog_offset),
        course_title=f"{c.course_title} {title_suffix}",
        departments=list(c.departments),
        academic_career=c.academic_career,
        credits=c.credits,
        description=c.description,
        tags=set(c.tags),
        prereqs=[],
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
            day=meet.day,
            start_time=meet.start_time + minute_shift,
            end_time=meet.end_time + minute_shift,
        )
        for meet in s.meetings
    ]
    return models.Section(
        course=new_course,
        class_num=s.class_num + class_num_offset,
        section_code=f"{s.section_code}{section_suffix}",
        instruction_modality=s.instruction_modality,
        enrollement_total=s.enrollement_total,
        class_capacity=s.class_capacity,
        meetings=shifted_meetings,
        instructor=s.instructor,
    )


def make_scaled_sections(base_sections: list[models.Section], copies: int = 50) -> list[models.Section]:
    out = list(base_sections)
    for i in range(1, copies + 1):
        for j, section in enumerate(base_sections):
            new_course = clone_course(
                section.course,
                catalog_offset=i * 100 + j,
                title_suffix=f"(X{i})",
            )
            minute_shift = (i % 4) * 15
            out.append(
                clone_section(
                    s=section,
                    new_course=new_course,
                    class_num_offset=i * 100000 + j * 1000,
                    section_suffix=f"X{i}",
                    minute_shift=minute_shift,
                )
            )
    return out
