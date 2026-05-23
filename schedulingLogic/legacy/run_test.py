#micah gentry

#load/build input data
#build constraints
#export dimacs/wcnf
#call a solver and print solutions

import sys
from pathlib import Path

SCHEDULER_DIR = Path(__file__).resolve().parents[1]
if str(SCHEDULER_DIR) not in sys.path:
    sys.path.insert(0, str(SCHEDULER_DIR))

from constraints import constraints
from wcnf import write_wcnf
from fixtures.test_data import student, sections

from constraints import constraints
from wcnf import write_wcnf
from fixtures.test_data import sections, make_scaled_sections

big_sections = make_scaled_sections(sections, copies=200)  # 200x growth
hard, soft = constraints(student, big_sections)
write_wcnf("generated/constraints_big.wcnf", hard, soft)
