#micah gentry

import json
from pysat.formula import WCNF
from pysat.examples.rc2 import RC2

import models

# optional: import your test sections so we can decode chosen classes
from test_data import sections

def decode_schedule(
    model: list[int],
    sections: list[models.Section],
) -> models.Schedule:
    # O(1) lookup by section variable id
    by_class_num = {s.class_num: s for s in sections}
    section_vars = set(by_class_num.keys())

    chosen_nums = [lit for lit in model if lit > 0 and lit in section_vars]
    chosen_sections = [by_class_num[num] for num in chosen_nums]

    return models.Schedule(classes=chosen_sections)


def section_to_ui_dict(section: models.Section) -> dict:
    """Serialize a Section into a UI-ready JSON shape."""
    cid = section.course.course_id
    return {
        "class_num": section.class_num,
        "section_code": section.section_code,
        "instruction_modality": section.instruction_modality.value,
        "instructor": section.instructor,
        "enrollment_total": section.enrollement_total,
        "class_capacity": section.class_capacity,
        "major_elective": section.major_elective,
        "attributes": sorted(list(section.attributes)),
        "course": {
            "subject_area": cid.subject_area,
            "catalog_number": cid.catalog_number,
            "course_title": section.course.course_title,
            "departments": section.course.departments,
            "academic_career": section.course.academic_career.value,
            "credits": section.course.credits,
            "description": section.course.description,
            "tags": sorted(list(section.course.tags)),
            "prereqs": [
                {"subject_area": p.subject_area, "catalog_number": p.catalog_number}
                for p in section.course.prereqs
            ],
        },
        "meetings": [
            {
                "day": meeting.day.value,
                "start_time": meeting.start_time,
                "end_time": meeting.end_time,
            }
            for meeting in section.meetings
        ],
    }


def schedule_to_ui_sections(schedule: models.Schedule) -> list[dict]:
    """Convert a solved Schedule into a list of UI section objects."""
    return [section_to_ui_dict(s) for s in sorted(schedule.classes, key=lambda x: x.class_num)]


def run():
    wcnf = WCNF(from_file="constraints_big.wcnf")

    with RC2(wcnf) as rc2:
        model = rc2.compute()   # best model (MaxSAT)
        cost = rc2.cost         # total weight of unsatisfied soft clauses
    
    print("Optimal cost:", cost)

    schedule = decode_schedule(model, sections)
    chosen = sorted(section.class_num for section in schedule.classes)

    print("Chosen class_nums:", chosen)
    print("Credits:", schedule.credits)

    for section in sorted(schedule.classes, key=lambda s: s.class_num):
        cid = section.course.course_id
        print(f"{section.class_num}: {cid.subject_area} {cid.catalog_number} sec {section.section_code}")

    ui_sections = schedule_to_ui_sections(schedule)
    print("\nUI sections JSON:")
    print(json.dumps(ui_sections, indent=2))

if __name__ == "__main__":
    run()
