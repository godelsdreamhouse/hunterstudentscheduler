#micah gentry
#main

#load/build input data
#build constraints
#export dimacs/wcnf
#call a solver and print solutions

from constraints import constraints
from wcnf import write_wcnf
from test_data import student, sections

from constraints import constraints
from wcnf import write_wcnf
from test_data import sections, make_scaled_sections

big_sections = make_scaled_sections(sections, copies=500)  # 200x growth
hard, soft = constraints(student, big_sections)
write_wcnf("constraints_big.wcnf", hard, soft)
