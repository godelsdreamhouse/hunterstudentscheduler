#micah gentry

from pysat.formula import WCNF
from pysat.examples.rc2 import RC2

# optional: import your test sections so we can decode chosen classes
from test_data import sections

def run():
    wcnf = WCNF(from_file="constraints.wcnf")

    with RC2(wcnf) as rc2:
        model = rc2.compute()   # best model (MaxSAT)
        cost = rc2.cost         # total weight of unsatisfied soft clauses

    print("Optimal cost:", cost)

    # decode chosen sections by class_num
    class_nums = {s.class_num for s in sections}
    chosen = sorted(v for v in model if v > 0 and v in class_nums)

    print("Chosen class_nums:", chosen)

if __name__ == "__main__":
    run()
