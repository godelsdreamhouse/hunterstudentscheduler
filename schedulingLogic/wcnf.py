#micah gentry
#wcnf 

from pathlib import Path
from typing import List, Tuple

def write_wcnf(
    path: str,
    hard: List[List[int]],
    soft: List[Tuple[int, List[int]]],
) -> None:
    # Collect all variable IDs used in any clause
    all_clauses = hard + [cl for _, cl in soft]
    lits = [abs(lit) for clause in all_clauses for lit in clause]
    num_vars = max(lits, default=0)

    # In WCNF, hard clauses get weight = top (strictly larger than sum of soft weights)
    soft_weight_sum = sum(w for w, _ in soft)
    top = soft_weight_sum + 1

    num_clauses = len(hard) + len(soft)

    with open(path, "w", encoding="ascii") as f:
        f.write(f"p wcnf {num_vars} {num_clauses} {top}\n")

        # Hard clauses
        for clause in hard:
            f.write(f"{top} " + " ".join(map(str, clause)) + " 0\n")

        # Soft clauses
        for weight, clause in soft:
            f.write(f"{weight} " + " ".join(map(str, clause)) + " 0\n")
