#micah gentry

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

if __name__ == "__main__":
    run()
