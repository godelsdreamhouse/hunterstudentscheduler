#micah gentry
#data structures
import numpy as np
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

class Major(str, Enum):
    CS = "COMPUTER SCIENCE"
    MATH = "MATHEMATICS"


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
    subject_area: str # 4 char's ex: CSCI
    catalog_number: int #5 digits, ex: 12700


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
    departmental: set[str] = field(default_factory=list) # maybe should be enums of depts?
    major_electives: set[Course] = field(default_factory=list)

@dataclass
class Course:
    course_id: CourseId
    course_title: str = "" #name of course, ex: Introduction to Computer Science
    departments: list[str] =field(default_factory=list) # name of dept that offers the course, ex: "Computer Science"
    academic_career: AcademicCareer # maybe this should be a set? im not sure, designated grad or undergrad
    credits: int = 3
    description: str = ""
    tags: set[str] = field(default_factory=set) #TODO: i think this should be enums

    prereqs: list[CourseId] = field(default_factory=list) #maybe this should be a two dimensional set with course + minimum passing grade



@dataclass(frozen=True) #makes class immutable
class Semester:
    year: int # 4 digit year e.g. "2006"
    season: Season # SPRING, SUMMER, FALL, WINTER


@dataclass
class Section:
    course: Course
    section_code: str = ""
    class_num: int # i think there are unique codes for each class every semester.. we need these!
    instruction_modality: Modality = Modality.INPERSON
    enrollement_total : int = 0
    class_capacity : int = 0
    meetings: list[Meeting] = field(default_factory=list)  # list, not single meeting
    instructor: str = ""
    attributes: set[str] = field(default_factory=set)
    major_elective: bool = False
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
class Requirement:
    name: str
    attribute: str
    fulfilled_by: list[Course]
    elective_credits_needed: int = 0


@dataclass
class StudentProgram:
    majors: list[Major] = field(default_factory=list)  # students majors
    minor_code: Optional[str] = None #Im not sure
    track_code: Optional[str] = None #im not sure about this one either



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
    classes_taken: set[CourseId] = field(default_factory=list)
    requirements_needed: set[Requirement] = field(default_factory=list) # should be same objects as attributes
    elective_prefrences: set[CourseId] = field(default_factory=list) #user input

@dataclass
class AvailableClasses:
    classes: list[Section] = field(default_factory=list)

@dataclass
class Schedule:
    classes: list[Section]
    credits: int = field(init=False)

    @property
    def credits(self) -> int:
        return sum(section.credits for section in self.classes)

