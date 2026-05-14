from typing import Dict, List, Tuple

import models
from pysat.pb import PBEnc



# helper function for during_blocked_time
def overlaps_in_time(a_start, a_end, b_start, b_end) -> bool:
    """returns true when two classes overlap in scheduled time"""
    return a_start < b_end and b_start < a_end


# checks if a section meets during a students blocked time
def during_blocked_time(student: models.StudentProfile, section: models.Section) -> bool:
    """returns true if class is during a students unavailable time"""
    for blocked in student.preferences.unavailable:
        for meeting in section.meetings:
            same_day = blocked.day == meeting.day
            if same_day and overlaps_in_time(
                blocked.start_time,
                blocked.end_time,
                meeting.start_time,
                meeting.end_time,
            ):
                return True
    return False


# adds weights to sections that meet during a preferred meeting time
def time_preferences(student: models.StudentProfile, section: models.Section) -> int:
    weight = 0
    if student.preferences.morning and section.time_category() == models.TimeOfDay.MORNING:
        weight += 3

    if student.preferences.afternoon and section.time_category() == models.TimeOfDay.AFTERNOON:
        weight += 3

    if student.preferences.evening and section.time_category() == models.TimeOfDay.EVENING:
        weight += 3

    return weight


# adds weights to sections that have students preferred modality
def modality_preferences(student: models.StudentProfile, section: models.Section) -> int:
    weight = 0
    if student.preferences.in_person and section.instruction_modality == models.Modality.INPERSON:
        weight += 3

    if student.preferences.remote and section.instruction_modality == models.Modality.REMOTE:
        weight += 3

    return weight


# adds weighted soft clauses and blocked-time hard clauses
def build_constraints(
    student: models.StudentProfile,
    section: models.Section,
    hard: list[list[int]],
    soft: list[tuple[int, list[int]]],
):
    num = section.class_num

    weight = time_preferences(student, section) + modality_preferences(student, section)

    weight = weight + len(section.course.tags) # more priority for courses for classes with more tags
    
    if during_blocked_time(student, section):
        hard.append([-num])
        return
    
    if not prereq_met(section, student):
        hard.append([-num])
        return
    
    if section.course.course_id in student.preferences.specific_courses: #student must take this course
       hard.append([num])
       return
    
    if section.course.department in student.preferences.departmental:
        weight = weight + 1

    if weight > 0:
        soft.append((weight, [num]))
    





# day-literal helpers
def allocate_day_vars(sections: List[models.Section]) -> Dict[models.Day, int]:
    """Allocate 7 fresh vars after the max section.class_num."""
    max_class_num = max((s.class_num for s in sections), default=0)
    return {
        models.Day.MONDAY: max_class_num + 1,
        models.Day.TUESDAY: max_class_num + 2,
        models.Day.WEDNESDAY: max_class_num + 3,
        models.Day.THURSDAY: max_class_num + 4,
        models.Day.FRIDAY: max_class_num + 5,
        models.Day.SATURDAY: max_class_num + 6,
        models.Day.SUNDAY: max_class_num + 7,
    }


def add_section_day_implications(
    sections: List[models.Section],
    day_var_by_day: Dict[models.Day, int],
    hard: list[list[int]],
):
    """
    For each day a section meets, enforce s -> d(day):
    CNF: (-s v d_day)
    """
    for section in sections:
        s = section.class_num
        days = {m.day for m in section.meetings}
        for day in days:
            d = day_var_by_day[day]
            hard.append([-s, d])


def add_less_days_soft(
    student: models.StudentProfile,
    day_var_by_day: Dict[models.Day, int],
    soft: list[tuple[int, list[int]]],
):
    """
    If student prefers fewer days on campus, reward day literals being false.
    Clause (-d) with positive weight encourages minimizing active campus days.
    """
    if not student.preferences.less_days:
        return

    for d in day_var_by_day.values():
        soft.append((2, [-d]))


def _shares_any_day(a: models.Section, b: models.Section) -> bool:
    days_a = {m.day for m in a.meetings}
    days_b = {m.day for m in b.meetings}
    return bool(days_a & days_b)


def _is_morning_evening_pair(a: models.Section, b: models.Section) -> bool:
    ta = a.time_category()
    tb = b.time_category()
    return (
        (ta == models.TimeOfDay.MORNING and tb == models.TimeOfDay.EVENING)
        or (ta == models.TimeOfDay.EVENING and tb == models.TimeOfDay.MORNING)
    )

def prereq_met(s: models.Section, student: models.StudentProfile) -> bool:
    """ checks if student has the pre-req's for a given course"""
    
    if len(s.course.prereqs) == 0: # course has no prereq's
        return True
    
    else:
        for prereq in s.course.prereqs:
            if prereq not in student.classes_taken: # student has not taken prereq
                return False
    
    return True


def add_less_gaps_soft(
    student: models.StudentProfile,
    sections: list[models.Section],
    soft: list[tuple[int, list[int]]],
):
    """
    Small penalty for selecting a morning section and an evening section
    that meet on at least one same day: penalize (s1 AND s2).

    Soft clause: (-s1 OR -s2)
    Violated only when both sections are selected.
    """
    if not student.preferences.less_gaps:
        return

    penalty = 1

    n = len(sections)
    for i in range(n):
        s1 = sections[i]
        for j in range(i + 1, n):
            s2 = sections[j]

            if not _shares_any_day(s1, s2):
                continue
            if not _is_morning_evening_pair(s1, s2):
                continue

            soft.append((penalty, [-s1.class_num, -s2.class_num]))

def balance_reqs_taken(sections: list[models.Section], hard: list[list[int]]):
    """Builds a hard constraint so if class is chosen and fulfills some req,
     another wont be chosed with that same req"""
    n = len(sections)
    for i in range(n):
        s1 = sections[i]
        for j in range(i +1, n):
            s2 = sections[j]

            for tag in s1.course.tags:
                if (tag in s2.course.tags):
                    hard.append([-s1.class_num, -s2.class_num]) #not 1 and 2 at the same time

def add_requirement_credit_caps(
    student: models.StudentProfile,
    sections: list[models.Section],
    hard: list[list[int]],
):
    for req in student.requirements_needed:
        tag = (req.name or "").strip()
        if not tag:
            continue
        if req.credits_needed <= 0:
            continue

        lits = []
        weights = []

        for s in sections:
            if tag in s.course.tags:
                lits.append(s.class_num)
                weights.append(int(round(s.course.credits * 2)))

        if not lits:
            continue

        bound = int(round(req.credits_needed * 2))
        enc = PBEnc.atmost(lits=lits, weights=weights, bound=bound, encoding=0)
        hard.extend(enc.clauses)




def constraints_new(student: models.StudentProfile, sections: List[models.Section]):
    """Build hard/soft constraints and day-literal map for debugging/decoding."""
    hard: list[list[int]] = []
    soft: list[tuple[int, list[int]]] = []

    for section in sections:
        build_constraints(student, section, hard, soft)

    balance_reqs_taken(sections, hard)
    add_requirement_credit_caps(student, sections, hard)
    # TEMP: disable day-variable constraints while PBEnc credit-cap aux vars are active.
    # Day vars currently share the same ID region as PB aux vars unless a global var allocator is used.
    # Keeping this empty avoids variable-ID collisions.
    day_var_by_day: dict[models.Day, int] = {}
    add_less_gaps_soft(student, sections, soft)

    return hard, soft, day_var_by_day
