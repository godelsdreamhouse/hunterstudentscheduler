#micah gentry
#data structures
import numpy as np
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

class AcademicCareer(str, Enum):
    UNDERGRADUATE = "UNDERGRADUATE"
    GRADUATE = "GRADUATE"

class TimeOfDay(str, Enum):
    MORNING = "MORNING"
    AFTERNOON = "AFTERNOON"
    EVENING = "EVENING"
    OTHER = "OTHER"

class Day(str, Enum):
    MONDAY = "MONDAY"
    TUESDAY = "TUESDAY"
    WEDNESDAY = "WEDNESDAY"
    THURSDAY = "THURSDAY"
    FRIDAY = "FRIDAY"
    SATURDAY = "SATURDAY"
    SUNDAY = "SUNDAY"


class Modality(str, Enum):
    INPERSON = "INPERSON"
    HYBRID = "HYBRID"
    REMOTE = "REMOTE"
    ASYNCHRONOUS = "ASYNCHRONOUS"


class Season(str, Enum):
    SPRING = "SPRING"
    SUMMER = "SUMMER"
    FALL = "FALL"
    WINTER = "WINTER"


@dataclass(frozen=True)
class CourseId:
    subject_area: str      # e.g. "CSCI"
    catalog_num: int       # e.g. 16000


@dataclass
class Meeting:
    day: Day
    start_time: int   # minutes after midnight
    end_time: int     # must be > start_time

@dataclass
class Prefrences:
    #hard constraints
    credit_lower_bound: float = .5 #credit bounds must be divisible by .5
    credit_upper_bound: float = 17.5
    unavailable: list[Meeting] = field(default_factory=list)
    #soft constraints
    morning: bool = False
    afternoon: bool = False
    evening: bool = False
    less_gaps: bool = False
    less_days: bool = False
    in_person: bool = False
    remote: bool = False

@dataclass
class Course:
    subject_area: str # 4 char's ex: CSCI
    catalog_number: int #5 digits, ex: 12700
    course_title: str #name of course, ex: Introduction to Computer Science
    departments: list[str] # name of dept that offers the course, ex: "Computer Science"
    academic_career: AcademicCareer # maybe this should be a set? im not sure, designated grad or undergrad
    credits: int
    description: str
    fulfills: list[tuple[str, int]] = field(default_factory=list) #maybe shoudl get rid of this

    prereqs: list[tuple[str, int]] = field(default_factory=list) #maybe this should be a two dimensional set with course + minimum passing grade
    coreqs: list[tuple[str, int]] = field(default_factory=list)

    @property
    def course_id(self) -> tuple[str, int]:
        return (self.subject_area, self.catalog_number)



@dataclass(frozen=True) #makes class immutable
class Semester:
    year: int # 4 digit year e.g. "2006"
    season: Season # SPRING, SUMMER, FALL, WINTER


@dataclass
class Section:
    course: Course
    section_code: str
    class_num: int # i think there are unique codes for each class every semester.. we need these!
    instruction_modality: Modality
    enrollement_total : int
    class_capacity : int
    meetings: list[Meeting] = field(default_factory=list)  # list, not single meeting
    instructor: str = ""
    
    def time_category(self) -> TimeOfDay:
        
        if not self.meetings:
            return TimeOfDay.OTHER
        
        earliest = min(m.start_time for m in self.meetings) #choose earliest start time

        if earliest < 60 * 11: #before 11:00am
            return TimeOfDay.MORNING
        
        elif earliest < 60 * 17: # between 11am-4:59pm
            return TimeOfDay.AFTERNOON

        else: # after 5pm
            return TimeOfDay.EVENING


@dataclass
class StudentProgram:
    majors: list[Major] = field(default_factory=list)  # students majors
    minor_code: Optional[str] = None #Im not sure
    track_code: Optional[str] = None #im not sure about this one either

@dataclass(frozen=True)
class Major:
    nysed_code: int # 5 digit code, ex: 02354 for COMPSI-BA
    concentration_code: str #need more info about this
    dept: str #maybe we should hard code in the departments for error catching?
    credits_required: int
    description: str
    required_courses: list[tuple[str, int]]

@dataclass
class Minor:
    minor_code: str
    dept: str
    credits_required: int
    description: str
    required_courses: list[Course]

@dataclass
class StudentProfile:
    emplid: int #8 digit code
    student_program: StudentProgram
    preferences: Prefrences
    classes_taken: list[CourseId] = field(default_factory=list)
    classes_needed: list[CourseId] = field(default_factory=list)

@dataclass
class AvailableClasses:
    classes: list[Section] = field(default_factory=list)

@dataclass
class Schedule:
    semester: Semester
    classes: list[Section]
    credits: int = field(init=False)

    @property
    def credits(self) -> int:
        return sum(section.credits for section in self.classes)


