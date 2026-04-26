from itertools import combinations
from typing import Dict, List, Tuple

import models

def less_days_on_campus(sections: list[models.Section], soft: list[tuple[int, list[int]]]) -> None:
    for a, b in iter
def overlaps(a_start, a_end, b_start, b_end) -> bool:
    return a_start < b_end and b_start < a_end

def unavailable_times(student: models.StudentProfile, section: models.Section) -> bool:
    for blocked in student.preferences.unavailable:
        for meeting in section.meetings:
            same_day = blocked.day == meeting.day
            if same_day and overlaps(blocked.start_time, blocked.end_time, meeting.start_time, meeting.end_time):
                return True
    return False

def time_preferences(student: models.StudentProfile, section: models.Section) -> int:
    
    weight = 0
    if student.preferences.morning and section.time_category == models.TimeOfDay.MORNING:
        weight += 3

    if student.preferences.afternoon and section.time_category == models.TimeOfDay.AFTERNOON:
        weight += 3
    
    if student.preferences.evening and section.time_category == models.TimeOfDay.EVENING:
        weight += 3
    
    return weight

def modality_preferences(student: models.StudentProfile, section: models.Section) -> int:
    weight = 0
    if student.preferences.in_person and section.instruction_modality == models.Modality.INPERSON:
        weight += 3
    
    if student.preferences.remote and section.instruction_modality == models.Modality.REMOTE:
        weight += 3

    return weight

def build_constraints(student: models.StudentProfile, section: models.Section, hard: list[list[int]], soft: list[tuple[int, list[int]]]):

    num = section.class_num

    weight = time_preferences(student, section) + modality_preferences(student, section)
    
    if weight > 0:
        soft.append((weight, [num]))

    if unavailable_times(student, section):
        hard.append([-num])
    
    return None

def constraints(student: models.StudentProfile, sections: set[models.Section]):
    
    hard: list[list[int]] = []
    soft: list[tuple[int, list[int]]] = []
    
    for section in sections:
        build_constraints(student, section, hard, soft)
    
    return hard, soft