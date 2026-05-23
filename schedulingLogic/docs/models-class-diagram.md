# Models Class Diagram

This diagram documents the Python domain model defined in `models.py`.

```mermaid
classDiagram
direction LR

class Major {
  <<enumeration>>
  CS
  MATH
}

class AcademicCareer {
  <<enumeration>>
  UNDERGRADUATE
  GRADUATE
}

class TimeOfDay {
  <<enumeration>>
  MORNING
  AFTERNOON
  EVENING
  OTHER
}

class Day {
  <<enumeration>>
  MONDAY
  TUESDAY
  WEDNESDAY
  THURSDAY
  FRIDAY
  SATURDAY
  SUNDAY
}

class Modality {
  <<enumeration>>
  INPERSON
  HYBRID
  REMOTE
  ASYNCHRONOUS
}

class Season {
  <<enumeration>>
  SPRING
  SUMMER
  FALL
  WINTER
}

class CourseId {
  +subject_area: str
  +catalog_number: int
}

class Meeting {
  +day: Day
  +start_time: int
  +end_time: int
}

class Prefrences {
  +credit_lower_bound: float
  +credit_upper_bound: float
  +unavailable: list~Meeting~
  +morning: bool
  +afternoon: bool
  +evening: bool
  +less_gaps: bool
  +less_days: bool
  +in_person: bool
  +remote: bool
  +departmental: set~str~
  +major_electives: set~Course~
}

class Course {
  +course_id: CourseId
  +course_title: str
  +departments: list~str~
  +academic_career: AcademicCareer
  +credits: int
  +description: str
  +tags: set~str~
  +prereqs: list~CourseId~
}

class Section {
  +course: Course
  +section_code: str
  +class_num: int
  +instruction_modality: Modality
  +enrollement_total: int
  +class_capacity: int
  +meetings: list~Meeting~
  +instructor: str
  +attributes: set~str~
  +major_elective: bool
  +time_category() TimeOfDay
}

class Requirement {
  +name: str
  +attribute: str
  +fulfilled_by: list~Course~
  +elective_credits_needed: int
}

class Semester {
  +year: int
  +season: Season
}

class StudentProgram {
  +majors: list~Major~
  +minor_code: Optional~str~
  +track_code: Optional~str~
}

class StudentProfile {
  +emplid: int
  +student_program: StudentProgram
  +preferences: Prefrences
  +classes_taken: set~CourseId~
  +requirements_needed: set~Requirement~
  +elective_prefrences: set~CourseId~
}

class Minor {
  +minor_code: str
  +dept: str
  +credits_required: int
  +description: str
  +required_courses: list~Course~
}

class AvailableClasses {
  +classes: list~Section~
}

class Schedule {
  +classes: list~Section~
  +credits() int
}

Meeting --> Day
Section --> TimeOfDay : returns
Prefrences --> Meeting : unavailable
Prefrences --> Course : major_electives
Course --> CourseId : course_id/prereqs
Course --> AcademicCareer
Section --> Course
Section --> Meeting
Section --> Modality
Semester --> Season
StudentProgram --> Major
StudentProfile --> StudentProgram
StudentProfile --> Prefrences
StudentProfile --> CourseId : classes_taken/elective_prefrences
StudentProfile --> Requirement : requirements_needed
Requirement --> Course : fulfilled_by
AvailableClasses --> Section
Minor --> Course : required_courses
Schedule --> Section
```
