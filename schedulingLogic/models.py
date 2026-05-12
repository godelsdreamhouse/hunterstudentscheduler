#micah gentry
#data structures
import numpy as np
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


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
    unavailable: set[Meeting]
    #soft constraints
    morning = False
    afternoon = False
    evening = False
    less_gaps = False
    less_days = False
    in_person = False
    remote = False

@dataclass
class Course:
    id: CourseId # subject-catalog num
    credits: int
    title: str
    description: str
    fulfills: set[str] = field(default_factory=set) #automatically gets emptyset

    prereqs: set[Course] = field(default_factory=set) 
    coreqs: set[Course] = field(default_factory=set)


@dataclass(frozen=True) #makes class immutable
class Semester:
    year: int # 4 digit year e.g. "2006"
    season: Season # SPRING, SUMMER, FALL, WINTER


@dataclass
class Section:
    course: Course
    section_code: str
    class_num: int # i think there are unique codes for each class every semester.. we need these!
    meetings: list[Meeting] = field(default_factory=list)  # list, not single meeting
    instruction_modality: Modality
    instructor: str = ""
    enrollement_total : int
    class_capacity : int

    def time_category(self) -> TimeOfDay:
        
        if not self.meetings:
            return TimeOfDay.UNKNOWN
        
        earliest = min(m.start_time for m in self.meetings) #choose earliest start time

        if earliest < 60 * 11: #before 11:00am
            return TimeOfDay.MORNING
        
        elif earliest < 60 * 17: # between 11am-4:59pm
            return TimeOfDay.AFTERNOON

        else: # after 5pm
            return TimeOfDay.EVENING


@dataclass
class StudentProgram:
    major_codes: set[str] = field(default_factory=set)  # e.g. {"CS_BA"}
    minor_code: Optional[str] = None
    track_code: Optional[str] = None

class Major:
    major_code: str
    concentration_code: str
    dept: str
    credits_required: int
    description: str
    required_courses: set[Course]

@dataclass
class Minor:
    minor_code: str
    dept: str
    credits_required: int
    description: str
    required_courses: set[Course]

@dataclass
class StudentProfile:
    emplid: int
    student_program: StudentProgram
    classes_taken: set[CourseId] = field(default_factory=set)
    classes_needed: set[CourseId] = field(default_factory=set)
    preferences: Prefrences

@dataclass
class AvailableClasses:
    classes: set[Section] = field(default_factory=set)

@dataclass
class Schedule:
    semester: Semester
    classes: set[Section]
    credits: int = field(init=False)

    @property
    def credits(self) -> int:
        return sum(section.credits for section in self.classes)
