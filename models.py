#micah gentry
#data structures

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


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
    dept: str      # e.g. "CSCI"
    num: int       # e.g. 160


@dataclass
class Meeting:
    day: Day
    start_time: int   # minutes after midnight
    end_time: int     # must be > start_time


@dataclass
class Course:
    course_id: CourseId
    credits: int
    description: str
    fulfills: set[str] = field(default_factory=set) #automatically gets emptyset
    prereqs: set[CourseId] = field(default_factory=set) 
    coreqs: set[CourseId] = field(default_factory=set)


@dataclass(frozen=True) #makes class immutable
class Semester:
    year: int # 4 digit year e.g. "2006"
    season: Season # SPRING, SUMMER, FALL, WINTER


@dataclass
class Section:
    course_id: CourseId
    section_id: int
    meetings: list[Meeting] = field(default_factory=list)  # list, not single meeting
    modality: Modality = Modality.INPERSON
    instructor: str = ""


@dataclass
class StudentProgram:
    major_codes: set[str] = field(default_factory=set)  # e.g. {"CS_BA"}
    minor_code: Optional[str] = None
    track_code: Optional[str] = None


@dataclass
class StudentProfile:
    emplid: int
    student_program: StudentProgram
    classes_taken: set[CourseId] = field(default_factory=set)
    classes_needed: set[CourseId] = field(default_factory=set)
    preferences: set[str] = field(default_factory=set)
