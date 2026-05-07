#micah gentry

from pysat.formula import WCNF
from pysat.examples.rc2 import RC2

import models

# optional: import your test sections so we can decode chosen classes
from test_data import sections

def decode_schedule(
    model: list[int],
    sections: list[models.Section],
    semester: models.Semester,
) -> models.Schedule:
    # O(1) lookup by section variable id
    by_class_num = {s.class_num: s for s in sections}
    section_vars = set(by_class_num.keys())

    chosen_nums = [lit for lit in model if lit > 0 and lit in section_vars]
    chosen_sections = [by_class_num[num] for num in chosen_nums]

    return models.Schedule(semester=semester, classes=chosen_sections)


def run():
    wcnf = WCNF(from_file="constraints.wcnf")

    with RC2(wcnf) as rc2:
        model = rc2.compute()   # best model (MaxSAT)
        cost = rc2.cost         # total weight of unsatisfied soft clauses

    print("Optimal cost:", cost)

    semester = models.Semester(year=2026, season=models.Season.FALL)
    schedule = decode_schedule(model, sections, semester)
    chosen = sorted(section.class_num for section in schedule.classes)

    print("Chosen class_nums:", chosen)
    print("Credits:", schedule.credits)

if __name__ == "__main__":
    run()
