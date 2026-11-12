# Architecture and Technical Change Plan

## Optional Manual Academic History for Smart Scheduler

**Status:** Architecture recommendation subject to two independent read-only
reviews. This document authorizes no code, scheduler, production database, rule
publication, or application behavior change.

## 1. Recommendation in brief

After the existing identity/session boundary is hardened and independently
verified, add manual academic history as a second private input to the existing
academic-modeling and MaxSAT pipeline. Do
not build a parallel scheduling engine and do not make the browser a degree-rule
authority.

Both DegreeWorks and manual entry should be normalized by trusted server-side code into the same versioned `AcademicPlanSnapshot`. The current scheduler can continue to load sections, apply ordinary schedule preferences, and run RC2 after a compatibility projection. However, Smart Scheduler integration must wait until synthetic end-to-end fixtures prove the relevant modeled rules. The current solver has two blocking correctness problems for degree-progress claims: it prevents selecting two courses with the same requirement tag, and it applies only maximum credit caps to a requirement without any minimum or allocation constraint.

The first delivery should support only the three currently modeled majors—Computer Science, Mathematics, and Political Science—and only reviewed program versions. It should proceed as isolated architecture/data/evaluator work so it does not delay manual scheduling or the current student beta.

## 2. Product boundary

The feature is an optional alternative to uploading DegreeWorks:

1. After an approved identity/authentication prerequisite is met, a student
   either uses a verified governing regime or selects a reviewed manifest as an
   explicitly unverified planning scenario.
2. The student enters academic history as structured facts.
3. Trusted server-side code validates and evaluates those facts against an exact
   published rule manifest while preserving whether its applicability to this
   student is verified or merely assumed for planning.
4. The student reviews remaining, satisfied, and unknown requirements with evidence.
5. Only after the scheduling correctness gate is met may a validated snapshot be used by the existing scheduler.

DegreeWorks remains the default and rollback path. Neither path is an official degree audit. Unknown facts must remain unknown; they must never be treated as completion merely to produce a schedule.

This is distinct from the public manual section planner. Manual academic history
is private and academic-rule-oriented. The current no-login beta has no active
application account/session boundary, and its academic-service calls are direct.
Production use of this feature is therefore gated on an approved identity,
authentication, service-authorization, and privacy lifecycle boundary. It
should not modify the public planner's storage boundary.

## 3. Evidence from the current system

### Current input path

- The frontend currently exposes `/planner`, `/upload`, `/requirements`, and
  `/preferences` without `ProtectedRoute`; only `/schedules` requires browser
  setup state (`src/app/routes.ts`, `SetupCompleteRoute.tsx`).
- The upload page sends a PDF to Java `/AuditParse`, builds a lossy
  `ParserPayload`, and stores derived audit data, GPA, credit totals, filename,
  and requirement summaries in unscoped tab `sessionStorage`
  (`UploadAudit.tsx`, `useAuditData.ts`). Reusing the same open tab can expose
  those educational records to another person; closing the tab clears them.
- Express keeps account routes and PostgreSQL-backed sessions behind
  `ENABLE_ACCOUNT_ROUTES`, which is disabled for the no-login beta
  (`backend/src/index.js`). The Java/Python services remain directly reachable
  rather than authorized through Express.
- Schedule generation sends the stored `parser_payload` to `/api/schedule/generate` (`src/app/pages/ViewSchedules.tsx`).
- The Java parser extracts DegreeWorks data; it is not a general catalog-rule engine (`parser/src/main/java/edu/hunter/watchtower/PDFParser/`).

### Current scheduling path

- Python already models the three majors and accepts `classes_taken` plus `requirements_needed` (`schedulingLogic/models.py`, `schedulingLogic/input_builder.py`).
- Candidate construction uses explicit `fulfilled_by` course IDs and removes taken courses (`schedulingLogic/candidate_builder.py`). The documented requirement-tag fallback is not present in the implementation.
- Existing term-section loading, taken-course exclusion, time conflicts, modality/open-seat preferences, credit limits, and RC2 execution are reusable (`schedulingLogic/api.py`, `schedulingLogic/constraints_new.py`).
- Prerequisites are currently flattened into an all-required list. This does not represent alternatives, minimum grades, placement, permission, or concurrency faithfully.

### Current solver blockers

Two implementation facts prevent honest claims that a generated schedule fulfills the student's modeled remaining requirements:

1. `balance_reqs_taken` prohibits selecting two sections that carry the same requirement tag (`schedulingLogic/constraints_new.py`). A student who appropriately needs two courses in the same bucket can therefore be blocked.
2. `add_requirement_credit_caps` adds only an at-most credit bound. It does not require any course or credit coverage for a requirement (`schedulingLogic/constraints_new.py`). The at-most concept may still be useful as a separate maximum-applicable-credit rule; it must not simply be renamed to a minimum.

Therefore the existing MaxSAT infrastructure should be retained, but schedule integration and requirement-fulfillment labels are gated on corrected semantics and synthetic end-to-end proof. Any edit under `schedulingLogic/` requires the owner's review before merge.

### Current catalog and database limits

- The `courses` table provides useful course facts but only integer credits and flattened prerequisite/corequisite arrays (`database/schema.sql`).
- Existing program elective tables support limited numeric/prefix rules and are not a complete degree-requirement model.
- The unused `studentProfiles` table does not match the canonical string course identity and should not be repurposed.
- The scraper's flattened prerequisites are advisory source data, not verified academic logic (`scraper/src/api/handlers/course_requirements.rs`).

## 3A. Exact current pipeline

The current production-facing data path is:

```text
DegreeWorks PDF
  -> browser POST /AuditParse directly to Java
  -> Java raw audit JSON
  -> browser buildParserPayload()
  -> browser unscoped sessionStorage
  -> browser POST /api/schedule/generate directly to Python
  -> build_student_profile()
  -> get_candidate_sections()
  -> _filter_candidate_sections()
  -> constraints_new()
  -> WCNF -> RC2
  -> decode_schedule()
  -> section JSON returned to browser
```

The academic-service calls bypass Express. Account routes and PostgreSQL-backed
sessions are disabled for the no-login beta, React academic routes are public,
and the scheduler receives a browser-generated planning identifier. Java and
Python accept direct requests without user-bound authorization. Before new
private academic history is accepted, persisted, or bound to a snapshot, the
product needs an approved identity/authentication boundary, authorization at the
service boundary, explicit same-tab/account-switch cleanup, and a retention
notice.

| Stage | Current implementation | Contract that moves forward |
| --- | --- | --- |
| Route gating | `src/app/routes.ts`, `SetupCompleteRoute.tsx` | Add an approved authenticated boundary; then `auditUploaded` becomes source-neutral `academicRecordReady` |
| Audit upload | `UploadAudit.tsx` posts directly to Java `/AuditParse` | Express should authenticate and proxy the upload; Java can remain the parser |
| DegreeWorks adapter | `src/lib/schedulePayload.ts::buildParserPayload` | Move academic normalization out of the trusted browser path |
| Browser storage | `useAuditData.ts` stores a lossy parser payload plus derived audit data in unscoped tab `sessionStorage` | Define same-tab handoff, account-switch, retention, and notice behavior; new real-student persistence requires privacy/schema approval |
| Scheduler request | `ViewSchedules.tsx` builds `parser_payload` and posts directly to Python | Post an opaque snapshot reference, or an external DTO whose provenance Express reassigns before recomputation, through an authenticated route |
| Python API | `api.py::GenerateScheduleRequest` contains two untyped dictionaries | Keep the legacy body during migration; add typed validation only in a protected scheduler PR |
| Solver input | `input_builder.py::build_student_profile` creates `StudentProfile` | Project a validated snapshot to a narrow solver-facing shape |
| Candidates | `candidate_builder.py::get_candidate_sections` uses `Requirement.fulfilled_by` | Use stable requirement IDs and explicit eligible course IDs from the evaluator |
| Eligibility | `api.py::_filter_candidate_sections` and `constraints_new.py::prereq_met` | Continue using a projection of verified completed/equivalent courses; unknown eligibility fails closed |
| Constraints | `constraints_new.py::constraints_new` | Preserve schedule/time/preference infrastructure; replace tag heuristics with explicit allocation semantics in a protected phase |
| Decode | `run_rc2.py::decode_schedule` keeps only positive section variables | Decode allocation variables too before claiming which requirement a course fulfills |

## 3B. New modules and ownership boundaries

Do not put raw attempts, transfer records, waivers, or catalog manifests directly
into `schedulingLogic/models.py`. That would force every solver function to know
about academic-audit semantics it does not need. Use three layers:

```text
academicPlanning/                 new, source-neutral evaluator package
  models.py                       AcademicPlanFacts / AcademicPlanSnapshot
  degreeworks_adapter.py          Java result -> source facts
  manual_adapter.py               form values -> source facts
  catalog_manifest.py             exact reviewed rule-manifest loader
  evaluator.py                    facts + manifest -> requirement results
  scheduler_projection.py         validated snapshot -> SchedulerProjection

backend/src/routes/
  academicRecords.js              authenticated evaluate/review/delete endpoints
  schedules.js                    authenticated scheduler proxy

schedulingLogic/                  existing protected MaxSAT service
  models.py                       solver-only types
  input_builder.py                SchedulerProjection -> StudentProfile
  candidate_builder.py            sections for eligible current-term courses
  constraints_new.py              selection/allocation constraints
  run_rc2.py                      section and allocation decoding
```

`academicPlanning/` is a proposed location, not an approved new service. It can
start as an offline Python library with synthetic fixtures. Deployment topology
is a later infrastructure decision. Keeping it separate makes Phase 1 useful
without changing the protected solver or production application.

## 3C. Exact type boundary

The rich academic model and the solver model should not be the same struct.

### Evaluator input

External request DTOs and trusted internal facts are deliberately different:

```text
ManualAcademicHistoryInput                 # browser-writable
  schema_version
  requested_planning_manifest_id
  claimed_regime_versions[]
  claimed_course_attempts[]
  claimed_external_awards[]

DegreeWorksUploadInput                     # browser-writable
  pdf_bytes

AcademicPlanFacts
  schema_version
  source_kind: student_supplied_degreeworks | manual | institutional
  evaluation_mode: verified_governing | planning_scenario
  source_revision
  regime_assertions[]
  source_requirement_assertions[]
  course_attempts[]
  external_awards[]
  exceptions[]
```

The external DTOs cannot set `source_kind`, authority, verification state,
evidence references, reviewed equivalencies, source requirement assertions, or
institutional exceptions. The authenticated server selects the adapter by
endpoint and assigns those fields from trusted provenance. Unknown JSON fields
are rejected. Manual `claimed_course_attempts` contain only entered claims—course
identity, status, term, grade when known, and earned credits when known. They do
**not** contain browser-computed satisfied requirements.

`RegimeAssertion` carries the claimed program/core/concentration regime,
authority, verification status, and evidence reference. A manual selection is
not verified merely because it was selected. `source_requirement_assertions`
preserves DegreeWorks-reported satisfied/remaining/exception determinations with
an explicit verification status and method. An ordinary uploaded PDF is always
`student_supplied_degreeworks`, its assertions are `unverified` with method
`none`, and its exceptions remain `degreeworks_unclassified`. A PDF signature,
branding, or successful parse does not establish authenticity. Only an approved
institutional integration or independently verifiable signed artifact may issue
`institutional_verified` assertions. Catalog evaluation may compare unverified
claims but must not prefer them over reviewed rules.

The current Java parser cannot populate the complete attempt model: its course
contract lacks attempt identity, term, repeat relationship, residency, and
structured exception authority, while the browser projection deduplicates by
course code and drops grades/credits. It may remain unchanged only for the
legacy compatibility projection. Full convergence requires a reviewed parser
contract/raw server-side extraction change, or explicit `unavailable_facts`
that block every rule depending on missing attempt semantics. The architecture
does not promise DegreeWorks/manual parity until real parser-shaped fixtures
prove it.

There are two deliberately separate evaluation modes:

- `verified_governing` requires a trusted institutional source for the student's
  applicable program/core/concentration regime. Its results may be described as
  student-specific planning results, still not an official degree audit.
- `planning_scenario` evaluates manual history against one reviewed manifest the
  student selected. The regime remains unverified and snapshot-level
  `governing_applicability` is `unknown`. The UI must say “Planning scenario based
  on your selected rules; Hunter applicability not verified,” never “your
  governing requirements.”

The recommended manual-history feature supports scenario mode. After the
protected solver correctness gate, a scenario snapshot may feed Smart Scheduler
only after explicit acknowledgment, and every result retains the scenario label
and manifest version. Changing the assumed manifest recomputes the snapshot and
shows a requirement/candidate diff. This preserves the requested manual-major
workflow without inventing institutional certainty.

### Evaluator output

`AcademicPlanSnapshot`, specified in Section 5, contains reviewed manifest
identity, explicit unknowns, and requirement results with allocations and
evidence. This is the canonical shared representation for both DegreeWorks and
manual facts.

### Solver projection

Only a validated snapshot can produce this narrower object:

```text
SchedulerProjection
  schema_version
  snapshot_id
  manifest_checksum
  evaluation_mode: verified_governing | planning_scenario
  governing_applicability: verified | unknown
  scenario_acknowledged: boolean
  majors: tuple[Major]
  completed_course_ids: frozenset[CourseId]
  requirements: tuple[SchedulingRequirement]
  prerequisite_eligible_course_ids: frozenset[CourseId]
  blocked_unknowns[]

SchedulingRequirement
  requirement_id: stable string
  label: display string
  eligible_course_ids: frozenset[CourseId]
  progress_measure: credits | course_count | boolean
  remaining_credits: fixed-point credit amount | none
  remaining_course_count: integer | none
  remaining_boolean: boolean | none
  term_min_credits: fixed-point credit amount | none  # explicit student target in v1
  term_min_courses: integer | none                    # explicit student target in v1
  term_min_boolean: boolean | none
  term_target_source: explicit_student | none
  term_priority: integer | none
  max_applicable_credits: fixed-point credit amount | none
  double_count_group_ids: frozenset[string]
```

`remaining_credits` describes degree progress. `term_min_credits`,
`term_min_courses`, or `term_min_boolean` describes what this single generated
schedule must cover, according to `progress_measure`. Remaining progress and a
term target cannot be the same field: a student may have 15 credits left in a
degree bucket but should not necessarily take all 15 in one term. The evaluator
establishes remaining progress. In the first supported policy, only a
requirement the student explicitly chooses to prioritize receives a positive
term minimum. The review UI shows those targets and rejects any individual
target that exceeds that requirement's remaining need. It must not reject a
target set merely because summed applied-credit targets exceed the schedule
credit upper bound: one selected course may legitimately advance multiple
requirements where reviewed double-count rules permit it. Cross-requirement
preflight must therefore be allocation-aware, respecting eligibility,
double-count groups, and unique selected-course load; otherwise the solver
returns a structured infeasibility explanation and lets the student revise the
targets. Without explicit targets, auto-selected courses must still allocate to
at least one remaining requirement. The proposed v1 policy defines applicable
degree progress lexicographically: advance more distinct remaining requirements
first, then select more unique applicable courses, then maximize capped applied
credits. It does not claim that raw applied-credit total is the first priority.
A future automatic critical-path policy needs separate academic and product
approval.

Subject to the owner's Decision 10 approval, the protected solver objective
should be lexicographic, implemented as staged solves or weight bands whose
bounds are proven in tests. Credit, course-count,
and Boolean requirements are not converted into one misleading scalar. Each
requirement advances only in its declared `progress_measure` and is capped at
its remaining amount:

1. satisfy section conflicts, credit bounds, prerequisites, explicit courses,
   and explicit requirement targets;
2. in the student's explicit `term_priority` order, maximize each targeted
   requirement's capped credit units, course slots, or Boolean completion;
3. maximize the number of distinct untargeted requirements advanced;
4. maximize unique selected courses that advance at least one remaining rule,
   counting a course only once even when permitted to double count;
5. maximize capped applied credit units as a final degree-progress tie-break;
6. optimize the existing time, modality, gap, and day preferences; and
7. canonicalize allocations without changing the selected schedule.

This prevents convenience preferences from trading away degree progress while
also avoiding a hard minimum for every remaining multi-term bucket.

For the initial compatibility phase, the representable subset of
`SchedulerProjection` is intentionally flattened into today's `parser_payload`
and `StudentProfile`. This adapter is lossy: stable IDs, counts, term targets,
caps, double-count groups, manifest identity, and unknowns are not representable.
It must reject snapshots that rely on those semantics rather than silently drop
them. Parity claims are limited to the supported legacy subset.

## 3D. Exact `schedulingLogic/models.py` changes

There are two distinct phases.

### Compatibility phase: no solver-struct mutation

Keep these existing fields unchanged:

```text
StudentProfile.classes_taken
StudentProfile.requirements_needed
Requirement.name
Requirement.attribute
Requirement.fulfilled_by
Requirement.credits_needed
```

Add the source-neutral evaluator and project both inputs to the existing shape.
For facts both sources can represent, equivalent DegreeWorks and manual facts
must produce identical `StudentProfile` values. Source-specific missing facts
must block or remain explicit before this lossy projection. Any unexplained
difference stops solver integration.

### Allocation phase: protected model change

Change `Requirement` from a display-name/tag bucket into a stable solver target:

```text
Requirement
  requirement_id: str
  label: str
  fulfilled_by: frozenset[CourseId]
  progress_measure: credits | course_count | boolean
  remaining_credits_half_units: int | None
  remaining_course_count: int | None
  remaining_boolean: bool | None
  term_min_credits_half_units: int | None
  term_min_courses: int | None
  term_min_boolean: bool | None
  term_target_source: explicit_student | none
  term_priority: int | None
  max_applicable_credits_half_units: int | None
  double_count_group_ids: frozenset[str]
```

Effects of that model change:

- `input_builder._to_requirement()` must validate every new field and reject
  duplicate `requirement_id` values, unknown progress measures, duplicate term
  priorities, and a target field that does not match the declared measure. It
  must require exactly one non-`None` remaining field matching
  `progress_measure`, validate the matching term target does not exceed that
  remaining value, and reject inactive remaining/target fields rather than
  interpreting sentinel zeroes. When `term_target_source` is `none`, every term
  target field and `term_priority` must be `None`. When it is
  `explicit_student`, exactly one positive (or `true` Boolean) target matching
  `progress_measure` is required; both inactive target families must be `None`,
  and `term_priority` must be a nonnegative integer unique within the request.
  Missing, negative, or duplicate priorities are rejected rather than assigned
  an implicit order.
- `candidate_builder.get_candidate_sections()` must index candidates by
  `requirement_id`, not `Requirement.name`.
- `Course.tags` should become `eligible_requirement_ids`; a temporary read-only
  compatibility property can avoid changing unrelated serializers in the same
  commit.
- `constraints_new.build_constraints()` must stop using `len(tags)` as an
  implicit academic-progress score.
- `balance_reqs_taken()` must be removed and replaced with allocation rules.
- `add_requirement_credit_caps()` must split into explicit term minimum,
  course-count, maximum-applicable, and double-count constraints.
- `run_rc2.decode_schedule()` must decode allocations as well as sections.
- `run_rc2.section_to_ui_dict()` and the TypeScript `ScheduleSection` type must
  add `applies_to[]` derived from decoded allocations, not raw catalog tags.
- API diagnostics must report stable IDs and unmet term targets without logging
  private history.

Do not replace `CourseId` with the rich canonical identity in this phase.
`CourseId(subject_area, integer catalog_number)` is lossy but is used throughout
candidate queries, prerequisites, fixtures, and serialization. Resolve aliases,
suffixes, cross-listings, and historical identities before projection, then
fail closed if an identity cannot be represented. A future `CourseId` migration
is a separate protected contract change.

## 3E. Exact solver encoding change

Retain each section's existing Boolean variable `x_s = class_num`. Introduce:

- `y_c`: course `c` is selected through one of its sections;
- `a_c_r`: selected course `c` is allocated to requirement `r`.
- `p_c_r`: fixed-point half-credit units from course `c` applied to credit-based
  requirement `r`, represented with a bounded PB integer encoding rather than a
  raw Boolean allocation weight.

Required relationships:

```text
x_s -> y_course(s)
y_c -> OR(all section variables for c)
a_c_r -> y_c
a_c_r is never created unless c is eligible for r
y_c and a_c_r bind 0 <= p_c_r <= course_credit_half_units(c) * a_c_r
for a credit requirement, a_c_r is true iff p_c_r > 0
y_c -> OR(a_c_r for each still-applicable eligible requirement), unless c is an
       explicit student-requested course allowed to make no degree progress
```

For each requirement, encode its approved single-term target:

```text
SUM(p_c_r) <= remaining_credit_half_units(r)
SUM(a_c_r) <= remaining_course_count(r)
allocation for a Boolean requirement is allowed only when remaining_boolean(r)

SUM(p_c_r) >= term_min_credit_half_units(r)  # when not none
SUM(a_c_r) >= term_min_courses(r)            # when not none
OR(a_c_r for c eligible for r) when term_min_boolean(r) is true
SUM(p_c_r) <= max_applicable_credit_half_units(r)  # when defined

term_min_credit_half_units(r) <= remaining_credit_half_units(r)  # when not none
term_min_courses(r) <= remaining_course_count(r)                  # when not none
term_min_boolean(r) implies remaining_boolean(r)                  # when not none
```

Exactly one target family is active for a requirement's declared
`progress_measure` when `term_target_source` is `explicit_student`: half-credit
pseudo-Boolean bounds for `credits`, allocation cardinality for `course_count`,
or a single disjunction for `boolean`. With target source `none`, all three
target fields are absent and no minimum clause is emitted. A Boolean
requirement has a zero-or-one remaining measure and advances by one only when
its canonical allocation contains at least one permitted evidence course; no
allocation is legal after it is satisfied, and it is never inferred from a tag.
For credit requirements the effective upper bound is the smaller of remaining
credit and any reviewed `max_applicable_credits` cap. These remaining-need caps
are hard constraints in both the selection model and the canonical allocation
pass, so `applies_to[]` cannot overstate progress.

Selected course credit and credit applied to a requirement are deliberately
different. For example, an eligible four-credit course has eight half-credit
units available, but when only three credits remain (or a reviewed rule caps
application at three), the canonical solution may set `p_c_r = 6`. The course
still contributes all four credits to the student's total schedule load while
only three advance that requirement. A hard maximum must never be expressed as
`course_credit(c) * a_c_r`, which would recreate the current four-credit versus
three-credit rejection. Course-count and Boolean requirements remain indivisible
unless a separately reviewed rule defines different semantics.

Double counting is controlled by allocation variables. Where two requirements
share a no-double-count group, at most one corresponding `a_c_r` may be true for
the same course. Where reviewed rules permit double counting, the same `y_c`
may support more than one allocation.

Allocation literals in the first RC2 model are feasibility witnesses, not
student-facing evidence. For the selected course set, run a deterministic
second allocation pass that preserves **all** first-pass allocation hard
constraints—eligibility, `a_c_r -> y_c`, `p_c_r` bounds, required allocation of
auto-selected courses, `term_min_credits`, `term_min_courses`,
`term_min_boolean`, maximum caps, and double-count rules. It then applies the
same progress hierarchy, minimizes surplus
allocations, and resolves remaining ties by stable manifest order. Only that
canonical allocation may populate `applies_to[]`. Allocation is forbidden when
a requirement has no remaining need. This prevents reassignment from invalidating
an explicit target and prevents arbitrary true `a_c_r` values from producing
false requirement labels.

This replaces two current heuristics:

- `balance_reqs_taken()` currently adds `[-x_s1, -x_s2]` whenever sections
  share a requirement name, incorrectly forbidding two courses in a multi-course
  bucket.
- `add_requirement_credit_caps()` currently creates only `PBEnc.atmost`; zero
  allocated credits satisfies it, and a four-credit course can be rejected for
  a three-credit cap.

The correct change is **not** merely switching `PBEnc.atmost` to `atleast`.
Minimum, maximum, course count, allocation, double counting, and one-semester
planning scope are separate semantics and require separate clauses and tests.

The current total-credit dynamic program already uses half-credit units. The
lossy boundaries are `courses.credits INTEGER`, `_to_course()` and
`_to_requirement()` coercing credits to `int`, and the separate requirement-cap
encoding. A future protected change must either preserve half-credit units
through ingestion and both input conversions or reject nonrepresentable credit
values. Variable-credit courses remain unsupported until separately approved.

## 3F. Prerequisite impact

Today `Course.prereqs` is a flat list and `prereq_met()` requires every listed
course to appear in `StudentProfile.classes_taken`. The rich snapshot must not
be passed directly into that function.

Initially, the evaluator should project only prerequisites it can establish
from completed Hunter courses or reviewed equivalencies. A transfer, grade,
placement, concurrency, or alternative-prerequisite unknown blocks the affected
candidate and produces a reason code. Later structured prerequisite work would
change `Course.prereqs`, `_row_to_course()`, `prereq_met()`, candidate diagnostics,
and synthetic tests; that is another protected scheduler change.

## 3G. API and browser contract changes

Recommended authenticated Express endpoints:

```text
POST   /api/academic-plans/evaluate
POST   /api/academic-plans/degreeworks
GET    /api/academic-plans/current          only if persistence is approved
PUT    /api/academic-plans/current          only if persistence is approved
DELETE /api/academic-plans/current          only if persistence is approved
POST   /api/schedules/generate
```

`/api/academic-plans/evaluate` accepts only `ManualAcademicHistoryInput`.
`/api/academic-plans/degreeworks` accepts only the PDF upload DTO. Neither route
accepts internal facts or provenance-bearing fields. The server selects the
source kind, assigns manual claims unverified status, parses DegreeWorks as
student-supplied evidence, and resolves trusted evidence only through approved
server-side sources. A manually selected regime remains unverified until such a
source confirms it. The endpoint returns a reviewable snapshot or blocking
unknowns; the browser never submits its own `fulfilled_by`, authority,
verification, reviewed equivalency, exception approval, or source assertion as
authoritative. A requested manifest can select `planning_scenario`; it cannot set
`verified_governing`. The server enters verified mode only from an approved
institutional regime source.

`/api/schedules/generate` derives the user from the Express session, ignores any
browser EMPLID, revalidates/recomputes the snapshot, and forwards a
`SchedulerProjection`. The current direct Python request remains available only
during a compatibility window and should not be the final trust boundary.

Frontend changes are consequently:

- replace `auditUploaded` with source-neutral `academicRecordReady`;
- add a source chooser and manual-history editor;
- rename browser display state from `AuditData` to `AcademicPlanReview` while
  retaining an in-memory legacy adapter;
- move `buildParserPayload()` authority to trusted server code;
- render snapshot evidence and unknowns before preferences;
- when approved server persistence exists, send only a user-bound snapshot
  reference/revision plus preferences to schedule generation; in a session-only
  design, resubmit the original external DTO plus a claimed manifest selection
  so the trusted server can reassign provenance and recompute the snapshot
  (never send internal facts or a client-computed snapshot as authority);
- render each returned section's `applies_to[]` labels, which are computed from
  solver allocations and filtered to the student's active snapshot.

This last field is the technical basis for showing only requirements that the
course is actually fulfilling for that student. Catalog attributes that are
already complete, inapplicable, or merely present on the course do not appear.

## 3H. File-by-file dependency matrix

| File or component | Planned change | Downstream effect | Protected/approval status |
| --- | --- | --- | --- |
| `academicPlanning/models.py` (new) | Facts, attempts, exceptions, snapshot, requirement results | Shared source-neutral representation | Academic interpretation review; no solver mutation |
| `academicPlanning/*_adapter.py` (new) | Both sources produce the shared facts shape, preserving source-specific evidence and explicit unknowns | Representable-subset comparison without invented parity | Academic correctness review |
| `academicPlanning/evaluator.py` (new) | Apply exact manifest and emit allocations/unknowns | Creates trusted remaining requirements | Academic-owner review before production use |
| `src/lib/schedulePayload.ts` | Legacy adapter only, then source-neutral types | Current DegreeWorks users remain compatible | Frontend contract review |
| setup routes/hooks/pages | Source chooser, manual entry, review, source-neutral gating | New optional workflow; DegreeWorks remains default | Product/accessibility/privacy review |
| `backend/src/routes/academicRecords.js` (new) | Authenticated validation/evaluation boundary | Stops trusting browser-derived results | Auth/privacy architecture approval |
| `backend/src/routes/schedules.js` (new) | Authenticated Python proxy | Session user replaces posted EMPLID | Auth/infrastructure approval |
| production DB | None for session-only prototype | No migration | Persistence later requires explicit approval |
| `schedulingLogic/api.py` | Later accept typed projection/snapshot reference | Stronger validation and trusted input | Protected owner review |
| `schedulingLogic/input_builder.py` | Projection adapter; legacy adapter retained | Both sources reach same `StudentProfile` | Protected owner review even if behavior-preserving |
| `schedulingLogic/models.py` | Later stable requirement/allocation fields | Candidate, constraint, decode changes | Protected owner review |
| `schedulingLogic/candidate_builder.py` | Stable IDs and explicit eligible course sets | Removes name/tag ambiguity | Protected academic/scheduler review |
| `schedulingLogic/constraints_new.py` | Allocation/min/max/count/double-count semantics | Schedule feasibility and course selection change | Protected owner review |
| `schedulingLogic/run_rc2.py` | Decode allocation variables and `applies_to` | Accurate degree-progress labels | Protected owner review |
| scheduler fixtures/tests/docs | Cross-source, constraint, response tests | Proves compatibility and semantics | Required before integration |

## 3I. Dependency-ordered PR sequence

1. **Architecture and offline fixtures only.** Version this document, operator
   inventory, synthetic histories, and expected snapshots. No runtime changes.
2. **Source-neutral evaluator core.** Add facts/snapshot types, exact manifest
   fixtures, and both adapters. No production route or scheduler import.
3. **Representable-subset parity harness.** Prove equivalent DegreeWorks and
   manual facts produce the same results only where both sources contain the
   required evidence. Missing DegreeWorks attempt semantics must become explicit
   unknowns, not invented parity. Compare the legacy `parser_payload` projection
   separately.
4. **Feature-flagged review UI.** Session-only manual entry and review using
   synthetic/offline evaluation; no schedule generation from manual history.
5. **Authenticated application boundary.** Approve, enable, and harden an
   Express identity/session boundary with account linking, per-record
   authorization, evaluator and scheduler proxies, service authentication, and
   approved logout/retention behavior. This remains subject to
   auth/privacy/infrastructure approval.
6. **Protected solver regression tests.** First encode the current defects as
   failing examples: multi-course bucket, four-credit course, no coverage,
   multi-tag allocation, fractional credit, and double-count policy.
7. **Protected solver model and allocation change.** Modify `models.py`, input,
   candidates, constraints, decode, response, and docs together. Keep the legacy
   DegreeWorks adapter and compare old/new candidate sets on fixtures.
8. **Manual-history Smart Scheduler flag.** Enable only for reviewed versions of
   Computer Science, Mathematics, and Political Science after all gates pass.

Every PR still receives two independent read-only reviews. Steps 5 and 7 remain
open for owner approval even if both reviewers pass.

## 4. Target trust boundary

Client-derived requirement results must never be trusted. The browser may collect and display facts, but it may not decide that requirements are satisfied or provide an authoritative `fulfilled_by` list.

Recommended flow:

```text
Verified student/account link (not available in the no-login beta)
        |
        | structured facts or opaque snapshot ID
        v
Authenticated Express boundary
        |
        | service-authenticated request
        v
Python academic evaluator
  - schema validation
  - alias/equivalency resolution
  - exact manifest loading
  - deterministic recomputation
        |
        v
AcademicPlanSnapshot stored/returned by trusted server
```

Two safe scheduling request designs are acceptable:

- Preferred if server persistence is approved: the client sends an opaque, user-bound snapshot reference. Express verifies ownership and Python reloads/revalidates the snapshot and its exact rule manifest.
- Without persistence: the client resends only the appropriate external DTO,
  and the authenticated server reassigns provenance before the Python evaluator
  recomputes the snapshot. Client-posted internal facts or a prior evaluation
  are display data only and cannot be trusted.

The Express-to-Python call needs service authentication, request validation, size limits, and an authenticated user context. A snapshot ID must be high entropy, bound to the authenticated user, and unusable to enumerate another student's data.

This is a hard prerequisite, not a deployment toggle. The no-login beta leaves
account routes/sessions disabled and academic routes public, while direct
Java/Python calls are not user-authorized through Express. Until identity,
authentication, service authorization, same-tab/account-switch cleanup,
retention, and session lifecycle are approved and tested, only synthetic,
nonstudent evaluator prototypes may use this boundary.

## 5. Shared source-neutral representation

Both adapters must produce the same validated schema in Phase 1—not necessarily
the same populated facts. Source-specific evidence is preserved, and fields the
current DegreeWorks parser cannot supply remain explicit unknowns. Equivalence
is asserted only for the representable subset demonstrated by real
parser-shaped fixtures.

Conceptual shape:

```text
AcademicPlanSnapshot
  schema_version
  snapshot_id
  subject_user_id (server-side binding, never trusted from client)
  generated_at
  evaluation_mode: verified_governing | planning_scenario
  governing_applicability: verified | unknown
  scenario_acknowledged_at | none
  source
    kind: student_supplied_degreeworks | manual | institutional
    source_revision | parser_version
    unavailable_facts[]
  regime_assertions[]
    regime_kind: major | core | concentration | transfer_pathway | opt_in
    version_id | unknown
    authority
    verification_status: verified | pending | rejected | unknown
    evidence_reference | none
  source_requirement_assertions[]
    source_requirement_id
    source_status: satisfied | remaining | unknown
    asserted_allocations[]
    authority
    verification_status: verified | unverified | rejected | unknown
    verification_method: institutional_api | signed_artifact | none | unknown
    evidence_reference
  rule_manifest
    manifest_id
    checksum
    review_status
  course_attempts[]  # Hunter attempts only
    attempt_id
    internal_course_id | unresolved
    display_or_effective_code
    term | unknown
    status: completed | in_progress | withdrawn | failed | repeated | unknown
    grade | unknown
    attempted_credits | unknown
    earned_credits | unknown
    origin: hunter
    repeat_relationship | unknown
    residency | unknown
    evidence
  external_awards[]
    external_award_id
    kind: transfer | ap | ib | clep | placement | other
    source_institution_or_exam_authority | unknown
    raw_external_identity
    external_course_or_exam_identity | unknown
    grade_or_score | unknown
    awarded_credit | unknown
    claimed_evidence
    equivalency_decision | none
      student_award_decision_id
      equivalency_policy_key
      hunter_course_identity_id | none
      applicable_credit_amount | none
      conditions_satisfied[]
      subject_user_id
      authority
      verification_status: verified | pending | rejected | unknown
      verification_method
      evidence_reference
  exceptions[]
    kind: substitution | waiver | exemption
    affected_requirement_id
    replacement_attempt_id | external_award_id | none
    approved_credit_amount | none
    requirement_scope
    effective_decision
    grants_credit: true | false
    asserted_source
    authority: institutional_verified | degreeworks_unclassified | manual_claim
    verification_status: verified | pending | rejected | unknown
    evidence_reference
  requirement_results[]
    stable_requirement_id
    status: satisfied | remaining | unknown | not_applicable
    progress: CreditProgress | CourseCountProgress | BooleanProgress
      CreditProgress
        measure: credits
        required_credits / applied_credits / remaining_credits
      CourseCountProgress
        measure: course_count
        required_course_count / applied_course_count / remaining_course_count
      BooleanProgress
        measure: boolean
        required_boolean / applied_boolean / remaining_boolean
    candidate_internal_course_ids[]
    allocations[]
    evidence[]
    warnings[]
  unavailable_facts[]
  blocking_unknowns[]
  global_warnings[]
```

### Required invariants

- An unavailable or ambiguous fact is explicit. It is not represented as `false`, zero, or an empty list.
- Every requirement result contains exactly one progress variant matching the
  manifest node's declared measure. Required, applied, and remaining values use
  the same units. Numeric measures satisfy `applied + remaining = required`
  where the rule is fully known; a required Boolean has exactly one of
  `applied_boolean` or `remaining_boolean` true. Values remain explicitly
  unknown when those invariants cannot be established. `SchedulerProjection`
  term targets are derived only from this typed progress state and cannot
  exceed its remaining value.
- Attempts are preserved individually so repeats, failed attempts, in-progress work, grades, and earned credits can be evaluated correctly.
- A transfer/exam/placement result has exactly one canonical
  `external_award_id`. Hunter equivalency and requirement allocations reference
  that entity; no duplicate pseudo-attempt may represent the same award.
- Raw external work is separate from a reviewed Hunter equivalency. Unevaluated
  transfer work cannot silently satisfy requirements or prerequisites.
- A catalog/articulation equivalency policy is not a decision about a student's
  award. A typed policy key identifies source institution or exam authority,
  exact external identity, grade/score threshold, credit range, pathway and
  applicability conditions. A separate decision binds that policy (or a
  documented student-specific evaluation) to one external award and the
  authenticated student. Only a server-created, verified student award decision
  may unlock prerequisites or satisfy requirements.
- AP, IB, CLEP, placement, and other examination/placement facts have distinct
  award kinds and do not masquerade as Hunter course attempts.
- Substitutions, waivers, and exemptions are typed. Only an institutionally
  verified source can activate one. A manual claim remains unknown, and the
  parser's generic `Requirement.exceptions` course list remains unclassified;
  neither is automatically reinterpreted as an approved student exception. A
  verified waiver can satisfy a named rule without inventing course credit,
  residency, a grade, equivalency, or prerequisite evidence.
- A substitution is bound to the exact Hunter attempt or external award, the
  approved amount, requirement scope, authority, and effective decision. A
  course identity alone cannot apply an approval to another repeat/attempt.
- Allocation is explicit: the result records which attempt/equivalency/exception was applied to which requirement. A course tag alone is not an allocation.
- DegreeWorks requirement assertions and exceptions are preserved with
  provenance. Reconciliation rules prefer an assertion only when its verification
  method proves trusted institutional authority for that student and manifest
  scope. They flag conflicts for review and never let an ordinary uploaded PDF
  or unverified manual claim override catalog evaluation. Catalog recomputation
  may flag a discrepancy but cannot silently erase verified official evidence.
- The same source facts plus the same complete rule manifest produce the same result.

## 6. Course identity

Use three deliberately separate concepts:

1. **Internal course identity:** stable canonical database/rule ID used for joins, aliases, equivalencies, and historical versions.
2. **Display/effective code:** the subject and number shown for the applicable term, such as a renamed or historical code.
3. **Scheduler projection:** the current `(subject, integer course number)` shape expected by protected scheduling code.

The scheduler projection is lossy. Suffixes, cross-listing, historical renumbering, and non-numeric codes can collide or fail to project. Alias resolution must consider effective dates and provenance. If one entered code maps to multiple internal identities, or an identity cannot be projected unambiguously, evaluation/scheduling fails closed for the affected rule. It must not pick the first match.

## 7. Catalog data and rule publication

An earlier read-only inspection of Hunter's public CourseDog data reported
program revisions, effective dates, specializations, nested requirement trees,
and separately referenced course sets. Reported operators included `allOf`, `completedAllOf`,
`completedAnyOf`, `completedAtLeastXOf`, `minimumCredits`, `minimumGrade`,
`courses`, `courseSets`, `freeformText`, and `none`. This establishes source
leads only: this architecture commit does not preserve the exact fetched
payloads, revision/course-set IDs, timestamps, or checksums needed to reproduce
those observations. It does **not** establish complete operator coverage for
the current Computer Science, Mathematics, or Political Science program
versions and cannot approve any version.

This is a useful ingestion source, not a live runtime oracle. Student requests should never depend on a live catalog API response.

### Proposed PostgreSQL reference architecture (not approved)

Keep public/versioned academic rules separate from private student facts. A
future migration would use immutable publication records rather than adding
rule columns to `courses` or reusing the lossy `studentProfiles` table.

| Table | Key fields | Purpose/invariant |
| --- | --- | --- |
| `academic_source_snapshots` | `source_snapshot_id`, catalog ID, fetched time, source checksum, raw public JSON reference | Reproducible input; never student data |
| `academic_course_identities` | immutable `course_identity_id`, authority/source identity | Stable rule key independent of mutable display codes and current `courses` rows |
| `academic_program_versions` | `program_version_id`, program code, effective range, source snapshot | One exact CS/Math/Political Science revision |
| `academic_concentration_versions` | `concentration_version_id`, parent program version, effective range | Concentrations are explicit, not inferred from courses |
| `academic_rule_manifests` | `manifest_id`, schema/importer version, checksum, review status, published time | Immutable after publication; only approved manifests are selectable |
| `academic_manifest_program_versions` | `manifest_id`, `program_version_id` with concrete FKs | Pins exact program versions |
| `academic_manifest_concentrations` | `manifest_id`, `concentration_version_id` with concrete FKs | Pins exact concentration versions |
| `academic_manifest_course_sets` | composite key `(manifest_id, course_set_version_id)` with concrete FKs | Pins exact resolved course sets and provides the target FK boundary |
| `academic_manifest_course_identities` | composite key `(manifest_id, course_identity_id)` with concrete FKs | Pins every course identity that rules may reference |
| `academic_manifest_attribute_definitions` | composite key `(manifest_id, attribute_definition_id)` with concrete FKs | Pins every course-attribute definition that rules may reference |
| `academic_manifest_alias_vocabularies` | primary/unique `manifest_id`, `alias_vocabulary_id`, with composite FK to the vocabulary | Pins exactly one immutable alias vocabulary per manifest |
| `academic_manifest_alias_versions` | composite key `(manifest_id, alias_vocabulary_id, alias_version_id)` with FKs through the manifest-vocabulary join and alias version | Proves every pinned alias belongs to that manifest's one vocabulary |
| `academic_manifest_equivalency_policies` | `manifest_id`, `equivalency_policy_key` with concrete FKs | Pins reviewed general policies, not student decisions |
| `academic_requirement_nodes` | stable requirement ID, manifest, operator, normalized parameters, parent/order | Normalized reviewed rule tree; unknown operators block publication |
| `academic_attribute_definitions` | immutable attribute ID, source version/checksum | Stable reviewed course-attribute target |
| `academic_requirement_targets` | `requirement_id`, `manifest_id`, and exactly one of `course_identity_id`, `course_set_version_id`, or `attribute_definition_id` | Composite FKs require the selected target version to belong to the same manifest; a check constraint enforces one target kind |
| `academic_course_set_versions` | course-set version ID, source ID, checksum | Immutable resolved course-set definition |
| `academic_course_set_members` | concrete FKs to course-set version and course identity | Membership frozen to the manifest |
| `academic_alias_vocabularies` | immutable vocabulary ID, authority, source snapshot/checksum, published revision | Lets corrected historical vocabularies coexist without mutating prior manifests |
| `academic_course_alias_versions` | immutable `alias_version_id`, vocabulary ID, FK to course identity, authority, normalized display code, `effective_range daterange`, source checksum | Historical/renamed/cross-listed lookup within one versioned vocabulary |
| `academic_equivalency_policies` | immutable typed policy key, source institution/exam authority, exact external identity, grade/score threshold, credit range, pathway/applicability conditions, Hunter identity, authority, effective range | General reviewed articulation policy; never itself proves a student's award |
| `academic_rule_reviews` | manifest, reviewer/authority, decision, timestamp, non-sensitive notes | Publication audit trail |

The dependency tables are deliberately concrete rather than polymorphic. In
particular, `academic_requirement_targets` uses these composite foreign keys:

```text
(manifest_id, course_identity_id)
  -> academic_manifest_course_identities
(manifest_id, course_set_version_id)
  -> academic_manifest_course_sets
(manifest_id, attribute_definition_id)
  -> academic_manifest_attribute_definitions
```

The target row has a check constraint requiring exactly one of the three target
columns to be non-null. This prevents a requirement in manifest A from silently
referencing a course set, course identity, or attribute definition that only
exists in manifest B.

The manifest-vocabulary row has `manifest_id` as its primary key, so a manifest
can pin only one vocabulary. Each alias dependency then uses both composite
foreign keys:

```text
(manifest_id, alias_vocabulary_id)
  -> academic_manifest_alias_vocabularies
(alias_vocabulary_id, alias_version_id)
  -> academic_course_alias_versions
```

The alias-version table therefore exposes a unique composite key on
`(alias_vocabulary_id, alias_version_id)`. This makes vocabulary membership a
database invariant rather than a publication-code convention.

Alias overlap cannot be enforced by an ordinary unique constraint. The proposed
migration would enable PostgreSQL `btree_gist` and apply an exclusion constraint
equivalent to:

```sql
EXCLUDE USING gist (
  alias_vocabulary_id WITH =,
  authority WITH =,
  normalized_display_code WITH =,
  effective_range WITH &&
)
```

That rejects overlapping effective-date ranges for the same authority and
normalized code **within one vocabulary**, while allowing an appended corrected
vocabulary to coexist with a previously published one. Cross-listed codes remain
separate alias rows pointing to the same course identity. Each manifest pins an
immutable vocabulary and its `alias_version_id` rows, so later correction or
renumbering cannot reinterpret an existing snapshot.

Unique constraints still prevent duplicate manifest dependencies, while the
composite foreign keys and one-target check prevent ambiguous target kinds.
Published rows are append-only; a source change creates a new manifest and
review, never an in-place reinterpretation. The current `courses.course_id` may
map to a stable academic course identity, but it is not itself assumed to be the
immutable rule key until Phase 0 proves that contract.

If private persistence is later approved, use a separate
`academic_plan_snapshots` table keyed by an opaque snapshot ID and verified user
ID, with `schema_version`, `manifest_id`, `revision`, encrypted/versioned payload
or normalized facts, creation/expiry/deletion timestamps, and optimistic
concurrency. Do not put raw PDFs, freeform narratives, or logs of the payload in
that table. Authorization, retention, backup expiry, and deletion must be
approved before the migration is written.

Any persisted `student_external_award_decisions` must also remain in the private
student-data boundary. It binds one user, one canonical external award, one
general equivalency policy (or documented student-specific decision), effective
conditions, authority, verification method, and immutable evidence reference.
It cannot be created from browser-supplied authority fields.

### Complete publication manifest

A publication checksum must pin the full transitive dependency closure, not only the top-level program record:

- normalized program and requirement nodes;
- every referenced course-set version and its resolved membership;
- internal course identities and effective/display aliases;
- the immutable alias vocabulary and every alias version referenced by it;
- reviewed general equivalency policies used by that release;
- supported operator semantics/importer version;
- concentration/specialization records;
- human-reviewed freeform interpretations, if any are admitted.

Changing any dependency creates a new manifest checksum and requires revalidation. A previously stored snapshot remains tied to its original manifest and is never silently reinterpreted.

### Governance is not one catalog-year scalar

A student's rules can involve separate regimes: major declaration/catalog version, Hunter/Common Core cohort, concentration declaration, transfer pathway, and explicit opt-ins to newer rules. Model these as typed selections with evidence, not one `catalog_year` string.

The application must not infer a regime solely from completed courses. In
`verified_governing` mode, an unverified governing regime makes the affected
evaluation unknown. In `planning_scenario` mode, the selected reviewed manifest
is an explicit assumption: its rules can be evaluated, but applicability to the
student remains unknown and visibly labeled. Changing either a verified regime
or an assumed scenario manifest recomputes the snapshot and shows a diff before
replacement.

### Proposed rule storage (not approved for production)

If later approved, use immutable-on-publication tables for sources, manifests,
program versions, requirement nodes/targets, course-set versions/memberships,
aliases, general equivalency policies, and reviews. Keep this public/versioned
rule data separate from private student academic data and student-specific award
decisions. Do not repurpose `studentProfiles`.

Publication should fail on unknown operators, unresolved IDs, ambiguous aliases, missing dependencies, unreviewed freeform text, date conflicts, checksum drift, or missing academic-owner approval.

## 8. What can be reused without modification

Subject to verification against the eventual shared snapshot projection:

- the existing DegreeWorks PDF parser only for the lossy legacy compatibility
  projection; full attempt/provenance convergence requires parser extension or
  explicit blocking unknowns;
- existing canonical course records where identity is unambiguous;
- section-query and term-filtering mechanics (not academic candidate assembly);
- exclusion of courses already taken after normalized attempt policy is applied;
- blocked-time, meeting-overlap, modality, seat-status, day/time preference, and overall credit-limit behavior;
- the RC2 engine and ordinary schedule serialization scaffolding (candidate
  assembly and `applies_to[]` response semantics require protected changes);
- parameterized query patterns and existing service deployment boundaries;
- scraper transport/retry/source-fetch patterns for a separately reviewed offline rules importer;
- current public planner catalog APIs for section browsing only.

Reuse means retaining the infrastructure, not asserting that all existing academic semantics are correct.

## 9. What requires extension outside protected solver semantics

- A source-neutral schema, validators, and adapters for both DegreeWorks and manual facts.
- A deterministic academic evaluator for a deliberately supported operator subset.
- Historical course/alias lookup rather than active-course-only search.
- Stable requirement IDs, typed evidence, explicit unknowns, and allocations.
- Source-neutral setup gating and requirements display while retaining the DegreeWorks rollback path.
- An authenticated Express-to-Python evaluation boundary; no client-authoritative results.
- Exact manifest validation and stale-snapshot handling.
- Privacy controls and a decided persistence/retention model before storing shared profiles.

These should still be independently reviewed because they affect academic interpretation and private data even when they do not edit MaxSAT logic.

## 10. Protected scheduler changes and gates

The following require owner review before merge because they change `schedulingLogic/` or its academic claims:

- typed snapshot acceptance or snapshot-to-`StudentProfile` projection in Python;
- correcting same-tag multi-course selection;
- separating requirement term minimums, course counts, maximum-applicable
  credits, and allocation semantics;
- explicit requirement allocation and double-count rules;
- structured boolean/grade/corequisite prerequisite handling;
- support for fractional or variable credits;
- response changes that claim a selected course fulfills a particular requirement.

Fractional and variable credits are not supported by the current integer-credit schema/solver assumptions. Such courses must remain unsupported or unknown until protected models, arithmetic, constraints, and tests are approved.

Before any schedule integration, synthetic end-to-end fixtures must prove:

- two valid courses may satisfy the same multi-course bucket;
- credit minima and course-count minima are required, not merely capped;
- allocations obey permitted and prohibited double counting;
- repeated/in-progress/failed attempts affect eligibility correctly;
- candidate generation uses explicit evaluated eligibility;
- unknown prerequisite/grade/concentration facts block affected candidates;
- DegreeWorks and manual facts produce equivalent academic projections only for
  the representable subset, with source-specific unknowns preserved;
- the legacy DegreeWorks path has no regression.

Until that gate passes, the evaluator may show an academic review to the student, but it must not feed the Smart Scheduler or label schedule courses as fulfilling requirements.

## 11. Unknown-fact policy

Unknowns are scoped to their consequences:

- If an unknown affects candidate eligibility, prerequisites, minimum grade, course identity/equivalency, concentration, repeat handling, credits, or allocation for a requirement, Smart Scheduler is blocked for that affected requirement.
- Do not simply omit that requirement and generate a schedule that appears complete.
- A general-education/core unknown may be nonblocking only when the user explicitly chooses a **major-only planning scope** and the UI/result clearly states that core progress was not evaluated.
- An unknown governing major regime or concentration blocks
  `verified_governing` evaluation. It may be modeled only as an explicitly
  unverified `planning_scenario`, never silently downgraded into one.
- Unsupported freeform rules remain unknown until human-reviewed and published.

The UI should explain which fact is missing, what it affects, and whether DegreeWorks or an adviser can resolve it.

## 12. Rules completed courses alone cannot establish

Course codes alone cannot reliably determine:

- major/core/concentration governing regimes or opt-ins;
- grades, P/NC treatment, repeats, exclusions, and minimum grades;
- earned or variable credit values;
- residency and in-major residency;
- transfer equivalency or transfer-pathway exemptions;
- AP/IB/CLEP credit, placement, language proficiency, or credit by examination;
- substitutions, waivers, exemptions, appeals, or departmental permission;
- section-specific writing or attribute designation;
- in-progress/concurrent/corequisite status;
- allocation and double counting across major, core, minor, or concentration;
- total/liberal-arts credits, GPA, graduation eligibility, financial aid, or enrollment permission.

The system must collect a validated fact, inherit documented DegreeWorks evidence, or return unknown.

## 13. Privacy, storage, and retention decision gate

Decide privacy and storage policy before implementing shared profile persistence.
The current no-login UI stores a lossy parser payload plus derived audit data,
GPA, credit totals, filename, and requirement summaries in unscoped tab
`sessionStorage`. Closing the tab clears it, but same-origin scripts can read it
and another person reusing the open tab can see it. It supplies neither identity
binding nor encryption. Any move to account-bound or persistent records needs an
explicit migration/deletion and retention decision.

For an initial evaluator prototype, prefer session-only data. If persistence is required, it needs explicit approval and decisions covering:

- purpose and minimum necessary fields;
- opt-in/notice and shared-device behavior;
- retention period, session-record lifecycle, deletion/export, logout behavior,
  and backup expiry;
- user-bound authorization and service-to-service authentication;
- encryption in transit and at rest;
- audit logs that exclude histories, grades, audit text, and freeform evidence;
- incident response and applicable educational-record obligations.

Avoid raw PDF retention, freeform transfer narratives, and EMPLID where not necessary. Production fixtures, CI artifacts, screenshots, and telemetry must use synthetic data only.

## 14. Phased implementation

### Phase 0 — offline source/operator/governance matrix

No application behavior, production database, or scheduler change.

- Capture the three supported majors and all transitive course-set, alias, and
  general equivalency-policy dependencies as offline artifacts.
- Store a sanitized, content-addressed source/operator inventory containing the
  exact immutable public payloads (or approved immutable references), fetch
  timestamps, catalog/program revision IDs, transitive course-set IDs, checksums,
  importer version, unsupported/freeform nodes, and reviewer disposition.
- For each of Computer Science, Mathematics, and Political Science, record the
  exact program revision ID, effective range, concentration IDs, every
  transitive course-set ID/version, every operator encountered, and each
  unsupported/freeform node. No version is selectable until this reproducible
  coverage matrix is reviewed.
- Inventory every operator, freeform rule, regime, concentration, credit form, and unavailable source fact.
- Define internal identity and historical alias rules.
- Define the complete publication manifest/checksum and academic approval process.
- Build synthetic rule and program fixtures, including repeats, in-progress work, transfer, exams, substitutions, waivers, concentrations, and unknowns.
- Decide major-only versus any verified core scope and decide privacy/persistence policy.

### Phase 1 — source-neutral core and both adapters

Still no schedule integration.

- Implement the shared snapshot domain and deterministic evaluator in isolated, nonproduction modules.
- Normalize **both** synthetic DegreeWorks input and manual input into the same
  snapshot schema in this phase. Missing DegreeWorks attempt semantics remain
  explicit unknowns, and parity is claimed only for the representable subset.
- Preserve attempts, transfer/equivalency, exam/placement facts, exceptions, allocations, and explicit unavailable markers.
- Add cross-source equivalence tests and fail-closed alias/manifest tests.
- Keep current DegreeWorks production behavior unchanged behind flags.

### Phase 2 — feature-flagged manual UI and trusted server evaluation

- Do not accept real student history until approved identity/account linking,
  authenticated sessions, per-record authorization, service authentication,
  same-tab/account-switch cleanup, and retention behavior pass the privacy gate.
- Enable one reviewed program/rule version at a time, beginning within the current three majors.
- Use authenticated Express plus service-authenticated Python evaluation, or an approved opaque user-bound snapshot store.
- Never accept browser-computed requirement results as authoritative.
- Show evidence, unknowns, regime/version, edit/recompute, and source-switch diffs.
- Render verified-governing and planning-scenario modes distinctly. Scenario
  mode requires explicit acknowledgment and keeps its unverified-applicability
  label on every downstream result.
- Keep manual evaluation separate from Smart Scheduler until Phase 3 gates pass.
- Keep DegreeWorks default and provide an atomic disable/rollback flag.

### Phase 3 — protected scheduler correctness and allocation

Requires owner review for every `schedulingLogic/` change.

- Replace same-tag exclusion with explicit allocation, term minimum, course
  count, and maximum-applicable-credit semantics.
- Add explicit allocations and double-count rules.
- Decide and implement structured prerequisite/corequisite handling.
- Add fractional/variable credit support only if required and approved.
- Run synthetic end-to-end cross-source and legacy regression fixtures.
- Only after these pass may snapshots feed Smart Scheduler and the product state
  which requirement a scheduled course fulfills. Planning-scenario snapshots
  additionally require acknowledgment and must describe fulfillment as relative
  to the selected scenario, not as verified governing progress.

### Phase 4 — bounded expansion

- Add other reviewed versions/concentrations within the current three majors.
- Add historical attributes and broader reviewed equivalencies.
- Add verified core/general-education subsets.
- Treat Psychology/generalized majors, minors, certificates, dual majors, and persistent profiles as separate approvals. None should delay the beta.

## 15. Verification plan

Use only synthetic academic records.

### Source-neutral evaluator

- Equivalent DegreeWorks and manual facts yield equivalent academic results
  apart from provenance only for facts both adapters can represent; missing
  attempt, regime, or exception evidence produces explicit unknowns.
- DegreeWorks requirement assertions retain source requirement IDs, status,
  allocations, authority, and evidence references through reconciliation.
- A structurally valid, successfully parsed student-uploaded DegreeWorks PDF
  cannot elevate its assertions or exceptions above `unverified` /
  `degreeworks_unclassified`; only an approved verification method can do so.
- Manual regime selections remain unverified until an approved authority and
  evidence reference confirm them; conflicting assertions fail closed.
- A planning scenario can evaluate one reviewed selected manifest without
  elevating its regime: snapshot applicability remains unknown, all results keep
  the scenario/version label, and no text calls the assumed rules the student's
  verified governing requirements.
- Changing the planning-scenario manifest recomputes results and presents a
  visible requirement, allocation, and candidate diff before replacement.
- Attempts/repeats/in-progress/failures, minimum grades, earned credits, substitutions, waivers, and exemptions have explicit boundary cases.
- One external award cannot also appear as a Hunter attempt or a second external
  award, and substitutions bind to one exact attempt or award plus approved
  amount, scope, authority, and effective decision.
- A general equivalency policy without a verified student award decision cannot
  satisfy a requirement or prerequisite. Test source institution/exam identity,
  grade/score threshold, credit, pathway, effective date, and student binding.
- Raw transfer without reviewed equivalency remains unknown and cannot unlock a prerequisite.
- AP/IB/CLEP/placement remain typed and follow only published rules.
- Unsupported operators and unavailable source facts return unknown.
- Ambiguous aliases fail closed.
- Results are deterministic for the same source facts and manifest.
- Academic-owner-authored golden outcomes are maintained independently of the
  importer and evaluator implementation so tests do not merely confirm their own
  transformation logic.

### Publication data

- Every manifest dependency resolves and its checksum is pinned.
- The sanitized evidence inventory records the exact public payload or immutable
  reference, fetch time, revision/course-set IDs, checksum, and importer version
  needed to reproduce each operator-coverage conclusion.
- Each manifest pins one immutable alias vocabulary and its alias versions;
  corrected appended vocabularies cannot reinterpret an existing snapshot.
- Effective ranges are coherent.
- No unpublished/unreviewed manifest can be selected.
- Dependency changes invalidate prior review and produce a human-readable diff.

### Protected scheduling gate

- Prove minimum coverage, count rules, same-bucket multiple selection, allocations, double counting, candidate eligibility, and prerequisite unknown behavior.
- Prove a selected four-credit course can apply exactly three credits to a
  three-credit remaining need while all four credits still count toward total
  schedule load.
- Prove `p_c_r` is nonnegative, cannot exceed the selected course's available
  half-credit units, is zero when unallocated, and cannot evade no-double-count
  policy through partial allocations.
- Prove that zero-target and already-satisfied requirements cannot receive an
  `applies_to` label, and that a course eligible for multiple requirements gets
  the same canonical allocation on repeated runs.
- Prove the canonical second pass preserves every explicit credit/count target
  satisfied by the first model and never reassigns away required evidence.
- Prove credit-based, count-based, and Boolean requirements each advance under
  the declared progress measure, including permitted double-count cases without
  counting one selected course twice in the unique-course objective.
- Prove a satisfied Boolean requirement cannot receive an allocation, while a
  remaining Boolean requirement can advance only through eligible evidence.
- Prove that an individual term target exceeding its requirement's remaining
  value is rejected before RC2. Cross-requirement preflight must use
  allocation-aware feasibility and unique selected-course load; it must not
  reject merely because summed applied-credit targets exceed the schedule
  credit upper bound when reviewed double counting can satisfy them. No-target
  schedules follow the approved lexicographic policy (distinct requirements,
  unique applicable courses, then capped applied credits) and do not require
  every remaining multi-term bucket.
- Prove explicit targets with missing, negative, or duplicate `term_priority`
  values are rejected, while untargeted requirements reject any supplied
  priority.
- Include a fixture where advancing more distinct requirements produces fewer
  applied credits than concentrating in one bucket, and prove the approved v1
  policy chooses the former.
- Prove that a student-requested course may be selected without an allocation
  only when the response explicitly labels it as requested but not currently
  degree-applicable.
- Prove DegreeWorks and manual snapshots lead to equivalent candidates only for
  equivalent representable facts; missing attempt semantics produce explicit
  source-specific unknowns.
- Preserve existing DegreeWorks behavior until the new path is explicitly enabled.

### Frontend/security/accessibility

- Approved identity/account linking, authenticated sessions, service
  authorization, and cross-user snapshot isolation before real student history
  is accepted.
- Same-tab handoff, logout, shared-device reuse, account switch, back/forward cache, and expired
  snapshot tests must prove one student's data cannot appear for another.
- Existing session-scoped records are cleared at the approved lifecycle points,
  and any future persistent records follow the approved retention policy.
- Client payload tampering cannot forge satisfaction or candidates. Reject or
  ignore attempts to forge source kind, verified regime, DegreeWorks assertions,
  reviewed equivalencies, institutional exceptions, evidence references, or
  another user's snapshot ID, and prove trusted fields are assigned server-side.
- Scenario acknowledgment is explicit, user-bound, manifest-bound, and stale
  after the selected manifest changes; scenario results never acquire verified
  governing status through acknowledgment.
- Keyboard-operable entry/edit/remove, semantic grouping, focus management, live errors, and non-color-only statuses.
- Persistence opt-in/delete/logout/shared-device and stale-manifest behavior.

## 16. Decisions needed before implementation

1. Which reviewed major program version is first?
2. Is the first scope explicitly major-only, or does it include a named verified core subset?
3. Which concentrations, if any, are included initially?
4. Which authority supplies major/core regime and opt-in facts for
   `verified_governing` mode?
5. Is session-only handling acceptable for the first UI, or is server persistence required?
6. Who is the academic owner authorized to approve an exact manifest checksum?
7. Are unresolved transfer/exam records displayable while excluded from evaluation?
8. Which prerequisite policy is acceptable before structured prerequisite support exists?
9. Is automated CourseDog ingestion operationally and legally approved?
10. Is the proposed v1 term-target policy approved: explicit student-selected
    targets, then for untargeted progress maximize distinct requirements before
    unique applicable courses before capped applied credits?
11. Which verified identity provider and account-linking proof will authorize
    private academic-plan endpoints?
12. Is the recommended planning-scenario policy approved: a student-selected,
    reviewed manifest may feed Smart Scheduler after explicit acknowledgment,
    while applicability remains unknown and visibly labeled throughout?

These decisions do not need to block the current beta. Phase 0 and synthetic Phase 1 work can proceed independently, while manual scheduling and reliability work continue.

## 17. Final classification

### Reuse now

Reuse the existing parser only for the legacy lossy adapter, plus section-query
and term-filtering mechanics, normal schedule-preference constraints, the RC2
engine, service scaffolding, and current three-major focus. Academic candidate
assembly, allocation decoding, and fulfillment serialization are not unchanged.

### Build without scheduling integration

Build the source-neutral snapshot, both adapters, offline rule ingestion/publication tooling, deterministic evaluator, trusted server boundary, synthetic tests, and manual review UI behind flags.

### Protected work requiring owner review

Any `schedulingLogic/` edit; solver coverage/count/allocation/double-count/prerequisite/credit changes; production database schema or rule publication; persistence of student histories; and academic interpretation enabling a program version.

### Do not build

Do not create a second scheduler, trust browser-derived academic results, call CourseDog live per student, guess unresolved academic facts, claim official audit/graduation outcomes, or let generalized-major research delay readiness for the three supported majors.

## 18. Sources and reviewed evidence

Repository evidence examined in the original investigation:

- Frontend routes, setup progress, audit storage, upload/review, schedule payload, and schedule request code under `src/`.
- Java DegreeWorks parser controller, parser, and tests under `parser/`.
- Python models, input/candidate builders, constraints, API, fixtures, and scheduler documentation under `schedulingLogic/`.
- PostgreSQL schema/migrations and backend course routes.
- Rust course and requirement scraper handlers.
- Manual planner branch route/catalog/planner artifacts.

Primary external references examined read-only:

- Hunter Undergraduate Catalog: <https://hunter-undergraduate.catalog.cuny.edu/>
- Computer Science BA: <https://hunter-undergraduate.catalog.cuny.edu/programs/COMPSCI-BA>
- Mathematics BA: <https://hunter-undergraduate.catalog.cuny.edu/programs/MATH-BA>
- Political Science BA: <https://hunter-undergraduate.catalog.cuny.edu/programs/POLSCI-BA>
- Hunter graduation/core/major requirements: <https://hunter-undergraduate.catalog.cuny.edu/academics/academic-requirements/general-requirements/requirements-for-graduation-hunter-core-and-major-field-of-study>
- Hunter transfer/advanced-standing policy: <https://hunter-undergraduate.catalog.cuny.edu/admissions/transfer-advanced-standing-admission>
- CourseDog Programs API reference: <https://coursedogcurriculum.docs.apiary.io/reference/programs>

The two initial independent architecture reviews evaluated technical
feasibility, academic correctness, privacy, and maintainability. This revision
incorporates their blocking findings: the real current authentication/storage
baseline, authenticated recomputation, representable-subset convergence with
explicit unknowns, separate external DTOs and trusted internal facts,
provenance-bearing regime and source assertions, canonical external awards,
verified student-specific equivalency decisions, exact substitution scope,
reproducible source artifacts, database-enforced version-scoped aliases,
partial-credit allocation, explicit solver gates,
three-layer course identity, transitive manifest checksums, multi-regime
governance, and a privacy decision before persistence. Both reviewers must
re-verify this exact revision before the recommendation is presented as final.

Only this architecture document was added on an isolated documentation branch.
No implementation file, production database, scheduler behavior, or application
behavior was changed for this investigation.
