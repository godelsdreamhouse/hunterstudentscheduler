# Protected scheduler audit and profiling

Status: research only. Reviewed against `origin/main` commit `cd6b5b0` on
2026-11-11. This work did not change Python code, dependencies, constraints,
weights, solver behavior, database data, or academic eligibility rules.

## Executive finding

One isolated MaxSAT reproduction confirmed that the requirement encoding can
reject a multi-course credit requirement that the current model otherwise
describes as needing six credits. A second confirmed that remaining
requirements are not hard per-term minima, but whether they should be is an
academic/product decision: a student cannot normally schedule every remaining
degree requirement in one term. The existing validator checks neither form of
requirement allocation.

A checked-in synthetic scaling artifact also demonstrates that sparse external
section identifiers can inflate the WCNF maximum variable number. It does not
establish the size or dominance of this effect for real Hunter data. Dense
internal identifiers are a profiling hypothesis, not an approved change.

## Confirmed behavior and correctness risks

### Multi-course credit requirements are made mutually exclusive

`balance_reqs_taken` adds a hard pairwise exclusion for every two sections that
share a requirement tag. That conflicts with `Requirement.credits_needed` when
one requirement legitimately needs more than one course.

An isolated RC2 case with two 3-credit sections carrying the same requirement
tag, a 6-credit schedule bound, and `credits_needed=6` was unsatisfiable. The
hard exclusions are in `schedulingLogic/constraints_new.py:231`.

### Potential contract gap: outstanding requirements are not hard per-term minima

Requirement tags reward candidate sections and cap selected credits, but do not
require a minimum allocation. Only explicitly requested courses are hard
requirements. In an isolated case with two outstanding requirement tags and a
3-credit schedule bound, RC2 selected only one tag. The independent validator
reported no error because it intentionally does not validate requirement
allocation.

The current request contract describes these as remaining degree requirements
and the credit range as a term target; it does not say that every remaining
requirement must appear in one term. The confirmed behavior therefore needs an
academic/product decision before it can be classified as a defect or changed.

### “Back-to-back” does not model adjacency or gaps

The UI maps “Prefer back-to-back classes” to `less_gaps`. The encoder only adds
a penalty when a morning section and an evening section occur on the same day;
it does not measure time between meetings or reward adjacent meetings. A
9–10 AM, 10–11 AM, and 5–6 PM fixture produced penalties only against the
evening section.

### UI and solver time categories disagree

The UI describes evening as starting at 4:00 PM. `Section.time_category()`
classifies starts before 5:00 PM as afternoon, so 4:00–4:59 PM sections are
optimized under a different category than the student selected.

### “Days on campus” includes remote meetings

The day-minimization encoding counts every meeting day without checking
modality. A remote synchronous section can therefore increase the metric shown
as “days on campus.”

### Async and TBA candidates can be lost before solving

Candidate lookup uses an inner join to `section_meetings`, while the scraper can
legitimately omit meeting rows for TBA/no-day/no-time sections. Those sections
are excluded even though the scheduler model and validator allow empty meeting
lists.

### Linked instructional components are unrepresentable

Candidate construction does not preserve the section association/component
fields needed for linked enrollment. The solver also hard-forbids selecting two
sections of the same course, which prevents a required lecture plus lab or
recitation from being represented. This must not be “fixed” by inferring links
from course codes or meeting compatibility.

### Prerequisite parsing can fail open

Malformed prerequisite strings from the database are silently dropped. Valid
parsed prerequisites use the current flat, completed-course-only interpretation;
OR groups, grades, corequisites, and concurrent enrollment are not modeled.
Academic interpretation needs explicit review before changing this behavior.

### Availability policy is incomplete

Candidate lookup accepts configured open and waitlist statuses plus a null
status, but does not independently reject full sections by enrollment/capacity.
The product needs an approved policy for full, waitlisted, unknown, tentative,
and stopped-enrollment sections before scheduler results can make reliable
availability claims.

### Parsed requirement attributes are unused

`Requirement.attribute` is populated but not used by the constraint encoder.
The trimmed requirement name acts as the course-tag identity. This may be a
contract mismatch; the intended academic meaning requires owner confirmation.

## Performance characterization

The measurements below generated constraints only; they did not query a
database or modify the solver.

| Synthetic case | Hard | Soft | Total | Time | Peak memory |
| --- | ---: | ---: | ---: | ---: | ---: |
| 25 sections, shared tag, upper bound 16 | 16,320 | 25 | 16,345 | 0.035 s | 2.26 MiB |
| 50 sections, shared tag, upper bound 16 | 33,295 | 50 | 33,345 | 0.066 s | 4.63 MiB |
| 100 sections, shared tag, upper bound 16 | 69,120 | 100 | 69,220 | 0.140 s | 9.61 MiB |
| 200 sections, shared tag, upper bound 16 | 148,270 | 200 | 148,470 | 0.294 s | 20.68 MiB |
| 100 sections, unique tags, upper bound 30 | 201,663 | 100 | 201,763 | not recorded | 27.84 MiB |

Credit-state exactly-one constraints grow roughly with the number of sections
times the square of the upper-credit state range. Per-course exclusions,
shared-tag exclusions, and overlap checks also use pairwise encodings in their
groups. The API writes and reparses a WCNF file and may run RC2 up to three times
within one default 20-second solver-loop deadline. Database access, constraint
generation, file writing, and WCNF parsing occur before that deadline begins.

The checked-in `schedulingLogic/generated/constraints_big.wcnf` begins with:

```text
p wcnf 20103201 804 2413
```

This file comes from the repository's synthetic scaling fixture, which adds
large artificial offsets to copied class numbers. It has only 603 distinct
variables. It proves that the raw-literal design can inflate the declared
maximum; it does not characterize actual Hunter identifiers or production
solver memory.

## Verification performed

- Input-builder tests: 2/2 passed.
- Schedule-validator tests: 17/17 passed.
- Isolated RC2 cases reproduced the shared-tag, missing-requirement, and
  back-to-back semantics above.
- No database-backed smoke test was run.
- System Python lacked `psycopg` and `python-sat`; the existing project virtual
  environment was used without changing dependencies.

## Approval-gated remediation sequence

1. Obtain academic approval for requirement allocation, credit/count semantics,
   prerequisite treatment, and linked enrollment combinations.
2. Define product/data-owner availability rules for full, waitlisted, unknown,
   tentative, and stopped-enrollment sections.
3. Add characterization tests that preserve the approved semantics before
   changing constraints.
4. Profile representative sanitized Hunter identifiers; if sparsity is material,
   map them to dense internal SAT variables and map them back only when decoding
   results.
5. Replace pairwise exactly-one/at-most-one encodings with scalable encodings
   where profiling demonstrates value.
6. Model actual gap duration and in-person campus days; align time boundaries
   with shared UI constants.
7. Preserve eligible async/TBA candidates and fail closed, with monitoring, on
   malformed academic data.
8. Reprofile representative synthetic and sanitized Spring 2027 workloads,
   then independently verify every protected change before merge.

No item above is authorized for implementation by this report.
