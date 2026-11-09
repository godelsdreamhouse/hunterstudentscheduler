# Architecture and Technical Change Plan

## Optional Manual Academic History for Smart Scheduler

**Status:** Architecture recommendation incorporating independent read-only review. This document authorizes no code, scheduler, production database, rule publication, or application behavior change.

## 1. Recommendation in brief

After the identity/authentication gate is met, add manual academic history as a
second private input to the existing academic-modeling and MaxSAT pipeline. Do
not build a parallel scheduling engine and do not make the browser a degree-rule
authority.

Both DegreeWorks and manual entry should be normalized by trusted server-side code into the same versioned `AcademicPlanSnapshot`. The current scheduler can continue to load sections, apply ordinary schedule preferences, and run RC2 after a compatibility projection. However, Smart Scheduler integration must wait until synthetic end-to-end fixtures prove the relevant modeled rules. The current solver has two blocking correctness problems for degree-progress claims: it prevents selecting two courses with the same requirement tag, and it applies only maximum credit caps to a requirement without any minimum or allocation constraint.

The first delivery should support only the three currently modeled majors—Computer Science, Mathematics, and Political Science—and only reviewed program versions. It should proceed as isolated architecture/data/evaluator work so it does not delay manual scheduling or the current student beta.

## 2. Product boundary

The feature is an optional alternative to uploading DegreeWorks:

1. After an approved identity/authentication prerequisite is met, a student selects a supported major and applicable academic rule regime.
2. The student enters academic history as structured facts.
3. Trusted server-side code validates and evaluates those facts against an exact published rule manifest.
4. The student reviews remaining, satisfied, and unknown requirements with evidence.
5. Only after the scheduling correctness gate is met may a validated snapshot be used by the existing scheduler.

DegreeWorks remains the default and rollback path. Neither path is an official degree audit. Unknown facts must remain unknown; they must never be treated as completion merely to produce a schedule.

This is distinct from the public manual section planner. Manual academic history
is private and academic-rule-oriented. The current no-login beta has no verified
user identity or authenticated application session; production use of this
feature is therefore gated on an approved identity and authentication boundary.
It should not modify the public planner's storage boundary.

## 3. Evidence from the current system

### Current input path

- The no-login frontend exposes `/upload`, `/requirements`, `/preferences`, and
  `/schedules` without `ProtectedRoute`; only `/schedules` is gated by browser
  setup state (`src/app/routes.ts`, `SetupCompleteRoute.tsx`).
- The upload page sends a PDF to Java `/AuditParse`, builds `ParserPayload`, and
  stores it in unscoped `sessionStorage` for the current tab
  (`UploadAudit.tsx`, `useAuditData.ts`). The same open tab can therefore expose
  one student's data to the next person using it.
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
  -> browser sessionStorage
  -> browser POST /api/schedule/generate directly to Python
  -> build_student_profile()
  -> get_candidate_sections()
  -> _filter_candidate_sections()
  -> constraints_new()
  -> WCNF -> RC2
  -> decode_schedule()
  -> section JSON returned to browser
```

This pipeline bypasses Express. Account routes and PostgreSQL sessions are
disabled by default in the no-login beta, the React routes are not protected,
and the scheduler receives a browser-generated planning-session ID. Java and
Python accept direct anonymous requests. Before private academic history is
accepted, persisted, or bound to a snapshot, the product needs approved identity
proofing, account-route/session enablement, authorization checks, and explicit
logout/account-switch/tab-handoff cleanup.

| Stage | Current implementation | Contract that moves forward |
| --- | --- | --- |
| Route gating | `src/app/routes.ts`, `SetupCompleteRoute.tsx` | Routes are public; identity/authentication is a prerequisite, then `auditUploaded` becomes source-neutral `academicRecordReady` |
| Audit upload | `UploadAudit.tsx` posts directly to Java `/AuditParse` | Express should authenticate and proxy the upload; Java can remain the parser |
| DegreeWorks adapter | `src/lib/schedulePayload.ts::buildParserPayload` | Move academic normalization out of the trusted browser path |
| Browser storage | `useAuditData.ts` stores normalized history, GPA, and summaries in unscoped tab `sessionStorage` | Synthetic prototype only until tab handoff/account-switch cleanup exists; persistence requires privacy/schema approval |
| Scheduler request | `ViewSchedules.tsx` builds `parser_payload` and posts directly to Python | Post an opaque snapshot reference, or source facts that Express recomputes, through an authenticated Express route |
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

```text
AcademicPlanFacts
  schema_version
  source_kind: degreeworks | manual
  source_revision
  academic_regime_selection
  course_attempts[]
  external_credits[]
  exceptions[]
```

For manual entry, `course_attempts` contain the actual entered facts—course
identity, status, term, grade when known, earned credits when known, and origin.
They do **not** contain browser-computed satisfied requirements.

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
  remaining_credits: fixed-point credit amount
  remaining_course_count: integer | none
  term_min_credits: fixed-point credit amount  # explicit student target in v1
  term_min_courses: integer                    # explicit student target in v1
  term_min_boolean: boolean
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
term minimum. The review UI shows those targets, rejects a target set whose
minimum credits exceed the schedule's upper bound, and lets the student revise
it. Without explicit targets, auto-selected courses must still allocate to at
least one remaining requirement and the optimizer maximizes applicable degree
progress. A future automatic critical-path policy needs separate academic and
product approval.

The protected solver objective should be lexicographic, implemented as staged
solves or weight bands whose bounds are proven in tests. Credit, course-count,
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
If identical DegreeWorks and manual facts do not produce identical
`StudentProfile` values, stop before solver integration.

### Allocation phase: protected model change

Change `Requirement` from a display-name/tag bucket into a stable solver target:

```text
Requirement
  requirement_id: str
  label: str
  fulfilled_by: frozenset[CourseId]
  progress_measure: credits | course_count | boolean
  remaining_credits_half_units: int
  remaining_course_count: int | None
  term_min_credits_half_units: int
  term_min_courses: int
  term_min_boolean: bool
  term_target_source: explicit_student | none
  term_priority: int | None
  max_applicable_credits_half_units: int | None
  double_count_group_ids: frozenset[str]
```

Effects of that model change:

- `input_builder._to_requirement()` must validate every new field and reject
  duplicate `requirement_id` values, unknown progress measures, duplicate term
  priorities, and a target field that does not match the declared measure.
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

Required relationships:

```text
x_s -> y_course(s)
y_c -> OR(all section variables for c)
a_c_r -> y_c
a_c_r is never created unless c is eligible for r
y_c -> OR(a_c_r for each still-applicable eligible requirement), unless c is an
       explicit student-requested course allowed to make no degree progress
```

For each requirement, encode its approved single-term target:

```text
SUM(course_credit(c) * a_c_r) >= term_min_credits(r)
SUM(a_c_r) >= term_min_courses(r)
OR(a_c_r for c eligible for r) when term_min_boolean(r) is true
SUM(course_credit(c) * a_c_r) <= max_applicable_credits(r)  # when defined
```

Exactly one target family is active for a requirement's declared
`progress_measure`: half-credit pseudo-Boolean bounds for `credits`, allocation
cardinality for `course_count`, or a single disjunction for `boolean`. A Boolean
requirement advances by one only when its canonical allocation contains at
least one permitted evidence course; it is never inferred from a tag.

Double counting is controlled by allocation variables. Where two requirements
share a no-double-count group, at most one corresponding `a_c_r` may be true for
the same course. Where reviewed rules permit double counting, the same `y_c`
may support more than one allocation.

Allocation literals in the first RC2 model are feasibility witnesses, not
student-facing evidence. For the selected course set, run a deterministic
second allocation pass that preserves **all** first-pass allocation hard
constraints—eligibility, `a_c_r -> y_c`, required allocation of auto-selected
courses, `term_min_credits`, `term_min_courses`, `term_min_boolean`, maximum
caps, and double-count rules. It then applies the same progress hierarchy, minimizes surplus
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

`/api/academic-plans/evaluate` accepts source facts and an explicit reviewed
regime selection. It returns a reviewable snapshot or blocking unknowns. The
browser never submits its own `fulfilled_by` result as authoritative.

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
  design, resubmit the original source facts plus manifest selection so the
  trusted server can recompute the snapshot (never send a client-computed
  snapshot as authority);
- render each returned section's `applies_to[]` labels, which are computed from
  solver allocations and filtered to the student's active snapshot.

This last field is the technical basis for showing only requirements that the
course is actually fulfilling for that student. Catalog attributes that are
already complete, inapplicable, or merely present on the course do not appear.

## 3H. File-by-file dependency matrix

| File or component | Planned change | Downstream effect | Protected/approval status |
| --- | --- | --- | --- |
| `academicPlanning/models.py` (new) | Facts, attempts, exceptions, snapshot, requirement results | Shared source-neutral representation | Academic interpretation review; no solver mutation |
| `academicPlanning/*_adapter.py` (new) | DegreeWorks and manual facts produce same input | Cross-source parity | Academic correctness review |
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
3. **Parity harness.** Prove equivalent DegreeWorks and manual facts produce the
   same snapshot and the same legacy `parser_payload` projection.
4. **Feature-flagged review UI.** Session-only manual entry and review using
   synthetic/offline evaluation; no schedule generation from manual history.
5. **Authenticated application boundary.** Express evaluation/upload/scheduler
   proxy, subject to auth/privacy/infrastructure approval.
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
Verified student identity (not present in the current no-login beta)
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
- Without persistence: the client resends structured source facts, and the authenticated server/Python evaluator recomputes the snapshot before scheduling. A client-posted prior evaluation is display data only and cannot be trusted.

The Express-to-Python call needs service authentication, request validation, size limits, and an authenticated user context. A snapshot ID must be high entropy, bound to the authenticated user, and unusable to enumerate another student's data.

This is a hard prerequisite, not a deployment toggle: account routes are
currently disabled by default and existing registration does not prove control
of the CUNY identity being linked. Until identity proofing and session lifecycle
are approved and tested, only synthetic, nonstudent evaluator prototypes may use
this boundary.

## 5. Shared source-neutral representation

Both adapters must produce the same validated representation in Phase 1—not in a later migration.

Conceptual shape:

```text
AcademicPlanSnapshot
  schema_version
  snapshot_id
  subject_user_id (server-side binding, never trusted from client)
  generated_at
  source
    kind: degreeworks | manual
    source_revision | parser_version
    unavailable_facts[]
  academic_regime
    major_program_version_id
    core_program_version_id | unknown
    concentration_version_id | none | unknown
    explicit_opt_ins[]
  rule_manifest
    manifest_id
    checksum
    review_status
  course_attempts[]
    attempt_id
    internal_course_id | unresolved
    display_or_effective_code
    term | unknown
    status: completed | in_progress | withdrawn | failed | repeated | unknown
    grade | unknown
    attempted_credits | unknown
    earned_credits | unknown
    origin: hunter | transfer | ap | ib | clep | placement | other
    repeat_relationship | unknown
    residency | unknown
    evidence
  external_credits[]
    raw_external_identity
    awarded_credit | unknown
    reviewed_hunter_equivalency | unresolved
    evidence
  exceptions[]
    kind: substitution | waiver | exemption
    affected_requirement_id
    replacement_course_id | none
    grants_credit: true | false
    asserted_source
    authority: institutional_verified | degreeworks_unclassified | manual_claim
    verification_status: verified | pending | rejected | unknown
    evidence_reference
  requirement_results[]
    stable_requirement_id
    status: satisfied | remaining | unknown | not_applicable
    credits_required / credits_applied
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
- Attempts are preserved individually so repeats, failed attempts, in-progress work, grades, and earned credits can be evaluated correctly.
- Raw transfer work is separate from a reviewed Hunter equivalency. Unevaluated transfer work cannot silently satisfy requirements or prerequisites.
- AP, IB, CLEP, placement, and other examination/placement facts have distinct origins and do not masquerade as Hunter course attempts.
- Substitutions, waivers, and exemptions are typed. Only an institutionally
  verified source can activate one. A manual claim remains unknown, and the
  parser's generic `Requirement.exceptions` course list remains unclassified;
  neither is automatically reinterpreted as an approved student exception. A
  verified waiver can satisfy a named rule without inventing course credit,
  residency, a grade, equivalency, or prerequisite evidence.
- Allocation is explicit: the result records which attempt/equivalency/exception was applied to which requirement. A course tag alone is not an allocation.
- DegreeWorks exceptions are preserved with provenance. Catalog recomputation may flag a discrepancy but cannot silently erase an official student-specific exception.
- The same source facts plus the same complete rule manifest produce the same result.

## 6. Course identity

Use three deliberately separate concepts:

1. **Internal course identity:** stable canonical database/rule ID used for joins, aliases, equivalencies, and historical versions.
2. **Display/effective code:** the subject and number shown for the applicable term, such as a renamed or historical code.
3. **Scheduler projection:** the current `(subject, integer course number)` shape expected by protected scheduling code.

The scheduler projection is lossy. Suffixes, cross-listing, historical renumbering, and non-numeric codes can collide or fail to project. Alias resolution must consider effective dates and provenance. If one entered code maps to multiple internal identities, or an identity cannot be projected unambiguously, evaluation/scheduling fails closed for the affected rule. It must not pick the first match.

## 7. Catalog data and rule publication

Read-only inspection of Hunter's public CourseDog data found program revisions,
effective dates, specializations, nested requirement trees, and separately
referenced course sets. Observed operators included `allOf`, `completedAllOf`,
`completedAnyOf`, `completedAtLeastXOf`, `minimumCredits`, `minimumGrade`,
`courses`, `courseSets`, `freeformText`, and `none`. This establishes source
shape only. It does **not** yet establish complete operator coverage for the
current Computer Science, Mathematics, or Political Science program versions.

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
| `academic_manifest_alias_versions` | composite key `(manifest_id, alias_version_id)` with concrete FKs | Pins the exact alias vocabulary used by evaluation |
| `academic_manifest_equivalencies` | `manifest_id`, `equivalency_version_id` with concrete FKs | Pins reviewed equivalency versions |
| `academic_requirement_nodes` | stable requirement ID, manifest, operator, normalized parameters, parent/order | Normalized reviewed rule tree; unknown operators block publication |
| `academic_attribute_definitions` | immutable attribute ID, source version/checksum | Stable reviewed course-attribute target |
| `academic_requirement_targets` | `requirement_id`, `manifest_id`, and exactly one of `course_identity_id`, `course_set_version_id`, or `attribute_definition_id` | Composite FKs require the selected target version to belong to the same manifest; a check constraint enforces one target kind |
| `academic_course_set_versions` | course-set version ID, source ID, checksum | Immutable resolved course-set definition |
| `academic_course_set_members` | concrete FKs to course-set version and course identity | Membership frozen to the manifest |
| `academic_course_alias_versions` | immutable `alias_version_id`, FK to course identity, authority, normalized display code, `effective_range daterange`, source checksum | Historical/renamed/cross-listed lookup with versioned effective dates |
| `academic_equivalencies` | immutable equivalency version, external identity, FK to course identity, authority, effective range | Only reviewed transfer/exam equivalencies |
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

Alias overlap cannot be enforced by an ordinary unique constraint. The proposed
migration would enable PostgreSQL `btree_gist` and apply an exclusion constraint
equivalent to:

```sql
EXCLUDE USING gist (
  authority WITH =,
  normalized_display_code WITH =,
  effective_range WITH &&
)
```

That rejects overlapping effective-date ranges for the same authority and
normalized code. Cross-listed codes remain separate alias rows pointing to the
same course identity. Each manifest pins immutable `alias_version_id` values,
so later renumbering cannot reinterpret an existing snapshot.

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

### Complete publication manifest

A publication checksum must pin the full transitive dependency closure, not only the top-level program record:

- normalized program and requirement nodes;
- every referenced course-set version and its resolved membership;
- internal course identities and effective/display aliases;
- reviewed transfer equivalencies used by that release;
- supported operator semantics/importer version;
- concentration/specialization records;
- human-reviewed freeform interpretations, if any are admitted.

Changing any dependency creates a new manifest checksum and requires revalidation. A previously stored snapshot remains tied to its original manifest and is never silently reinterpreted.

### Governance is not one catalog-year scalar

A student's rules can involve separate regimes: major declaration/catalog version, Hunter/Common Core cohort, concentration declaration, transfer pathway, and explicit opt-ins to newer rules. Model these as typed selections with evidence, not one `catalog_year` string.

The application must not infer a regime solely from completed courses. If the student cannot verify it, the affected evaluation is unknown. Changing a regime recomputes the snapshot and shows a diff before replacement.

### Proposed rule storage (not approved for production)

If later approved, use immutable-on-publication tables for sources, manifests, program versions, requirement nodes/targets, course-set versions/memberships, aliases, equivalencies, and reviews. Keep this public/versioned rule data separate from private student academic data. Do not repurpose `studentProfiles`.

Publication should fail on unknown operators, unresolved IDs, ambiguous aliases, missing dependencies, unreviewed freeform text, date conflicts, checksum drift, or missing academic-owner approval.

## 8. What can be reused without modification

Subject to verification against the eventual shared snapshot projection:

- the existing DegreeWorks PDF parser as a source adapter;
- existing canonical course records where identity is unambiguous;
- candidate section loading and term filtering;
- exclusion of courses already taken after normalized attempt policy is applied;
- blocked-time, meeting-overlap, modality, seat-status, day/time preference, and overall credit-limit behavior;
- RC2 and schedule serialization as optimization infrastructure;
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
- equivalent DegreeWorks and manual facts produce equivalent academic projections;
- the legacy DegreeWorks path has no regression.

Until that gate passes, the evaluator may show an academic review to the student, but it must not feed the Smart Scheduler or label schedule courses as fulfilling requirements.

## 11. Unknown-fact policy

Unknowns are scoped to their consequences:

- If an unknown affects candidate eligibility, prerequisites, minimum grade, course identity/equivalency, concentration, repeat handling, credits, or allocation for a requirement, Smart Scheduler is blocked for that affected requirement.
- Do not simply omit that requirement and generate a schedule that appears complete.
- A general-education/core unknown may be nonblocking only when the user explicitly chooses a **major-only planning scope** and the UI/result clearly states that core progress was not evaluated.
- An unknown governing major regime or concentration blocks major evaluation entirely.
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
The current no-login browser stores audit data in unscoped `sessionStorage`.
That limits it to the tab but leaves it readable by same-origin scripts and by a
second person reusing the open tab. Setup preferences/progress use localStorage.
Neither mechanism supplies identity binding or encryption.

For an initial evaluator prototype, prefer session-only data. If persistence is required, it needs explicit approval and decisions covering:

- purpose and minimum necessary fields;
- opt-in/notice and shared-device behavior;
- retention period, deletion/export, logout behavior, and backup expiry;
- user-bound authorization and service-to-service authentication;
- encryption in transit and at rest;
- audit logs that exclude histories, grades, audit text, and freeform evidence;
- incident response and applicable educational-record obligations.

Avoid raw PDF retention, freeform transfer narratives, and EMPLID where not necessary. Production fixtures, CI artifacts, screenshots, and telemetry must use synthetic data only.

## 14. Phased implementation

### Phase 0 — offline source/operator/governance matrix

No application behavior, production database, or scheduler change.

- Capture the three supported majors and all transitive course-set/alias/equivalency dependencies as offline artifacts.
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
- Normalize **both** synthetic DegreeWorks input and manual input into the same snapshot in this phase.
- Preserve attempts, transfer/equivalency, exam/placement facts, exceptions, allocations, and explicit unavailable markers.
- Add cross-source equivalence tests and fail-closed alias/manifest tests.
- Keep current DegreeWorks production behavior unchanged behind flags.

### Phase 2 — feature-flagged manual UI and trusted server evaluation

- Do not accept real student history until identity proofing, authenticated
  sessions, authorization, and account/tab cleanup pass the privacy gate.
- Enable one reviewed program/rule version at a time, beginning within the current three majors.
- Use authenticated Express plus service-authenticated Python evaluation, or an approved opaque user-bound snapshot store.
- Never accept browser-computed requirement results as authoritative.
- Show evidence, unknowns, regime/version, edit/recompute, and source-switch diffs.
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
- Only after these pass may snapshots feed Smart Scheduler and the product state which requirement a scheduled course fulfills.

### Phase 4 — bounded expansion

- Add other reviewed versions/concentrations within the current three majors.
- Add historical attributes and broader reviewed equivalencies.
- Add verified core/general-education subsets.
- Treat Psychology/generalized majors, minors, certificates, dual majors, and persistent profiles as separate approvals. None should delay the beta.

## 15. Verification plan

Use only synthetic academic records.

### Source-neutral evaluator

- Equivalent DegreeWorks and manual facts yield equivalent academic results apart from provenance.
- Attempts/repeats/in-progress/failures, minimum grades, earned credits, substitutions, waivers, and exemptions have explicit boundary cases.
- Raw transfer without reviewed equivalency remains unknown and cannot unlock a prerequisite.
- AP/IB/CLEP/placement remain typed and follow only published rules.
- Unsupported operators and unavailable source facts return unknown.
- Ambiguous aliases fail closed.
- Results are deterministic for the same source facts and manifest.

### Publication data

- Every manifest dependency resolves and its checksum is pinned.
- Effective ranges are coherent.
- No unpublished/unreviewed manifest can be selected.
- Dependency changes invalidate prior review and produce a human-readable diff.

### Protected scheduling gate

- Prove minimum coverage, count rules, same-bucket multiple selection, allocations, double counting, candidate eligibility, and prerequisite unknown behavior.
- Prove that zero-target and already-satisfied requirements cannot receive an
  `applies_to` label, and that a course eligible for multiple requirements gets
  the same canonical allocation on repeated runs.
- Prove the canonical second pass preserves every explicit credit/count target
  satisfied by the first model and never reassigns away required evidence.
- Prove credit-based, count-based, and Boolean requirements each advance under
  the declared progress measure, including permitted double-count cases without
  counting one selected course twice in the unique-course objective.
- Prove that explicit term targets exceeding the credit upper bound are rejected
  before RC2, while no-target schedules still maximize degree-applicable credits
  and do not require every remaining multi-term bucket.
- Prove that a student-requested course may be selected without an allocation
  only when the response explicitly labels it as requested but not currently
  degree-applicable.
- Prove DegreeWorks and manual snapshots lead to equivalent candidates for equivalent facts.
- Preserve existing DegreeWorks behavior until the new path is explicitly enabled.

### Frontend/security/accessibility

- Identity proofing, account-route/session enablement, authentication, and
  cross-user snapshot isolation before real student history is accepted.
- Same-tab handoff, logout, account switch, back/forward cache, and expired
  snapshot tests must prove one student's data cannot appear for another.
- Client payload tampering cannot forge satisfaction or candidates.
- Keyboard-operable entry/edit/remove, semantic grouping, focus management, live errors, and non-color-only statuses.
- Persistence opt-in/delete/logout/shared-device and stale-manifest behavior.

## 16. Decisions needed before implementation

1. Which reviewed major program version is first?
2. Is the first scope explicitly major-only, or does it include a named verified core subset?
3. Which concentrations, if any, are included initially?
4. Which authority supplies major/core regime and opt-in facts?
5. Is session-only handling acceptable for the first UI, or is server persistence required?
6. Who is the academic owner authorized to approve an exact manifest checksum?
7. Are unresolved transfer/exam records displayable while excluded from evaluation?
8. Which prerequisite policy is acceptable before structured prerequisite support exists?
9. Is automated CourseDog ingestion operationally and legally approved?
10. Is the v1 term-target policy approved as explicit student-selected
    requirements plus maximum degree-progress optimization for the remaining
    schedule?
11. Which verified identity provider and account-linking proof will authorize
    private academic-plan endpoints?

These decisions do not need to block the current beta. Phase 0 and synthetic Phase 1 work can proceed independently, while manual scheduling and reliability work continue.

## 17. Final classification

### Reuse now

Reuse the existing parser as a DegreeWorks adapter, existing course/section retrieval, normal schedule-preference constraints, RC2 infrastructure, service boundaries, and current three-major focus.

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

The two independent architecture reviews evaluated technical feasibility, academic correctness, privacy, and maintainability. Their blocking findings are incorporated here: authenticated recomputation, Phase 1 convergence of both sources, a richer attempt/evidence model, consequence-scoped unknown blocking, explicit solver defects and gates, three-layer course identity, transitive manifest checksums, credit limitations, multi-regime governance, and a privacy decision before persistence.

Only this architecture document was added on an isolated documentation branch.
No implementation file, production database, scheduler behavior, application
behavior, commit, or PR was changed or created for this investigation.
