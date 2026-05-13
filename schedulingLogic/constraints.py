from itertools import combinations
from typing import Dict, List, Tuple

import models

#helper function for during_blocked_time
def overlaps_in_time(a_start, a_end, b_start, b_end) -> bool:
    """returns true when two classes overlap in scheduled time"""
    return a_start < b_end and b_start < a_end

#checks if a section meets during a students blocked time
def during_blocked_time(student: models.StudentProfile, section: models.Section) -> bool:
    """returns true if class is during a students unavailable time"""
    # iterate through blocked class time slots
    for blocked in student.preferences.unavailable:
        #iterate through class times of a section
        for meeting in section.meetings:
            same_day = blocked.day == meeting.day
            if same_day and overlaps_in_time(blocked.start_time, blocked.end_time, meeting.start_time, meeting.end_time):
                return True
    return False

#adds weights to sections that meet during a prefered meeting time ; morning, afternoon, evening
def time_preferences(student: models.StudentProfile, section: models.Section) -> int:
    
    weight = 0
    if student.preferences.morning and section.time_category() == models.TimeOfDay.MORNING:
        weight += 3

    if student.preferences.afternoon and section.time_category() == models.TimeOfDay.AFTERNOON:
        weight += 3
    
    if student.preferences.evening and section.time_category() == models.TimeOfDay.EVENING:
        weight += 3
    
    return weight

#adds weights to sections that have students preferred modality ; remote, inperson
def modality_preferences(student: models.StudentProfile, section: models.Section) -> int:
    weight = 0
    if student.preferences.in_person and section.instruction_modality == models.Modality.INPERSON:
        weight += 3
    
    if student.preferences.remote and section.instruction_modality == models.Modality.REMOTE:
        weight += 3

    return weight

#adds weights of section and adds sectiona dn weight into list of constraints ; hard or soft
def build_constraints(student: models.StudentProfile, section: models.Section, hard: list[list[int]], soft: list[tuple[int, list[int]]]):
    """"adds constraints with weights to list of soft constraints, adds unavailable times to hard constraints"""
    num = section.class_num

    weight = time_preferences(student, section) + modality_preferences(student, section)
    
    if weight > 0:
        soft.append((weight, [num]))

    if during_blocked_time(student, section):
        hard.append([-num])
    
    return None

#runs build_constraints on each section in the set of sections. returns all constraint clause's
def constraints(student: models.StudentProfile, sections: set[models.Section]):
    """"iterates through all sections to run build_constraints on each one"""
    hard: list[list[int]] = []
    soft: list[tuple[int, list[int]]] = []
    
    for section in sections:
        build_constraints(student, section, hard, soft)

            
    
    return hard, soft