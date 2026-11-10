# Smart Scheduler requirement-allocation change plan

Status: architecture only. This document does not change the protected Python
scheduler, production schema, API behavior, or deployed application. Every
implementation PR that touches `schedulingLogic/` requires owner review.

## Decision summary

Keep the existing candidate loader, MaxSAT/RC2 engine, section feasibility
constraints, and preference optimization. Replace requirement-name course tags
as solver semantics with explicit course-to-requirement allocation variables.
Run degree progress as the primary optimization and ordinary schedule preferences
as the secondary optimization. Return the decoded allocation evidence with each
schedule so the UI can state exactly which remaining requirement each selected
course advances.

Do not create a parallel scheduler. Do not infer completion, eligibility,
double-counting, substitutions, waivers, or exceptions from display attributes.
Those facts must come from the validated academic snapshot specified by the
separately reviewed branch `docs/manual-history-architecture-pr59` in
`docs/architecture/manual-academic-history.md`. This plan depends on that reviewed
projection contract; the referenced document is intentionally not duplicated on
this branch.

"Validated" here means structurally and semantically validated for planning; it
does not mean institutionally verified. An ordinary uploaded DegreeWorks PDF is
`source_kind: student_supplied_degreeworks`, and its assertions remain
unverified. Unless a future authenticated Hunter source establishes ownership and
the governing catalog regime, the shared projection and every result use
`evaluation_mode: planning_scenario`, `governing_applicability: unknown`, and the
student-visible statement: "Planning scenario based on your selected rules;
Hunter applicability not verified."

The allocation-aware endpoint must not consume the current browser-built
`parser_payload` as academic authority. The Java parser issues a short-lived,
signed source-assertion envelope containing its DegreeWorks-derived facts. Its
signature proves only that Watchtower parsed the supplied bytes; it does not
prove document authenticity, ownership, or Hunter applicability. The
browser forwards that envelope without rebuilding academic fields. The Python
scheduler verifies issuer, signature, expiry, source-schema version, and
non-identifying planning-session correlation. Separately, the browser sends an
explicit, untrusted `PlanningChoices` DTO for the selected reviewed manifest,
scenario acknowledgment, requirement term targets, and their priority. A
server-side academic
projection module evaluates those facts against an owner-reviewed manifest. Only
that evaluated `SchedulerProjection` reaches candidate construction. A structurally
valid but unsigned legacy payload is rejected by the allocation-aware endpoint.
Offline migration comparisons may exercise the old path, but it cannot produce a
student-beta Smart schedule or personalized fulfillment claim.

## Why the current pipeline is incorrect

The current request and solve path is:

```text
UploadAudit / schedulePayload.ts
  -> parser_payload.requirements_needed[*].fulfilled_by
  -> input_builder.py::build_student_profile
  -> candidate_builder.py::get_candidate_sections
  -> constraints_new.py::constraints_new
  -> api.py::RC2
  -> run_rc2.py::decode_schedule
  -> validate_schedule.py
  -> ScheduleResponse -> Planner
```

The approved allocation-aware path becomes:

```text
DegreeWorks parser -> short-lived signed unverified source-assertion envelope
  -> browser sessionStorage (opaque forwarding only)
  -> read-only server projection preview for manifest/version/requirement IDs
  + browser PlanningChoices (manifest/acknowledgment/targets only)
  -> scheduler signature/schema/expiry + planning-choice verification
  -> server-side academic projection module + reviewed three-major manifest
  -> shared validated SchedulerProjection (provenance + planning-scenario mode)
  -> input_builder.py::build_student_profile(SchedulerProjection, ui_payload)
  -> existing candidate_builder PostgreSQL loading
  -> allocation-aware MaxSAT/RC2 stages
  -> independent allocation validator
  -> versioned ScheduleResponse
  -> tab-memory-only UI attribution
```

Two independent synthetic reproductions expose interacting defects:

1. `balance_reqs_taken` adds pairwise exclusion clauses for every pair of
   sections sharing a requirement-name tag. A six-credit bucket that legitimately
   needs two three-credit courses therefore becomes unsatisfiable.
2. `add_requirement_credit_caps` creates only `PBEnc.atmost` constraints. It
   prevents exceeding a bucket but never requires or prioritizes degree progress,
   so unrelated requested courses can fill the term-credit target.

The course tags are also the wrong identity boundary. Names are not stable IDs,
the same course can be eligible for multiple rules, and a catalog attribute does
not prove how a course was allocated for this student.

## Supported first-phase rule contract

The protected correction should support only an explicit credit-based rule for
which the evaluated planning snapshot provides all of the following:

- a request-unique `requirement_id`;
- a student-facing label;
- positive remaining credits in half-credit increments;
- a non-empty explicit set of eligible Hunter course IDs;
- an explicit `term_target_source`, with student-selected `term_priority` only
  when the rule has a positive term target, from the shared projection; and
- an explicit `max_applicable_credits` bound when the rule needs one; first-phase
  credit rules permit partial application of the final eligible course without
  changing that course's schedule-load credits.

Rules based on course count, GPA, minimum grades, residency, sequences,
concentrations, permissions, transfer articulation, substitutions, waivers, or
cross-rule double counting remain unsupported until the shared academic evaluator
produces a typed, validated projection. If even one remaining rule is unsupported,
empty, stale, lacks required evidence, or is an unacknowledged planning scenario,
Smart generation fails closed with
`UNSUPPORTED_ACADEMIC_RULES` and a list of opaque requirement IDs plus safe
student-facing labels. The UI must say no complete Smart schedule can be produced;
it must not present a partial schedule as covering the degree. Major-elective
course sets may be hydrated from owner-reviewed manifests. Writing Intensive and
Hunter Focus remain unsupported: repository evidence says Writing Intensive is
section-specific, while Hunter Focus includes Hunter-residency and course-count
semantics. The current course-level attribute/schema and this credit-only model
cannot establish either. A Smart request that still needs either rule fails
closed until a separate owner-approved contract supplies section designation,
residency, and course-count evidence; this plan does not claim that manifest
hydration alone solves them.

For migration fixtures only, the parser service may assign deterministic
request-scoped IDs such as `req-0` before signing the projection. The scheduler
never assigns academic meaning to an unsigned browser value. These IDs are
response correlation keys only; they do not become persistent academic identities.

### Signed source transport and shared planning projection

The Java parser returns compact JWS using detached RFC 7797 unencoded payloads
over the exact UTF-8 bytes of RFC 8785 JSON Canonicalization Scheme output. The
protected header permits only `alg: EdDSA`, requires an allowlisted `kid`, sets
`typ: watchtower-academic-source+jws`, `b64: false`, and `crit: ["b64"]`, and
includes no academic facts. The signed
payload requires `iss: watchtower-parser`, `aud: watchtower-scheduler-v2`, a
128-bit random `jti`, `iat`, `nbf`, `exp`, `source_schema_version`, a random
non-identifying planning-session correlation, `source_kind`,
`source_verification_status`, majors/concentrations/catalog-regime assertions,
completed-course assertions, remaining-rule assertions, and `unavailable_facts`.
Maximum lifetime is 15 minutes, accepted clock skew is 30 seconds, decoded
payload size is capped at 256 KiB, list/string nesting and lengths have explicit
schema limits, and unknown headers/critical parameters are rejected. Java and
Python use pinned JOSE implementations with Ed25519/EdDSA support; they do not
implement cryptography or canonical JSON themselves.

The response DTO carries two fields: the canonical payload JSON bytes encoded as
base64url in `source_payload`, and the detached compact serialization
`BASE64URL(protected)..BASE64URL(signature)` in `source_jws`. The verifier decodes
`source_payload`, rejects noncanonical or duplicate-key JSON, and verifies the JWS
over those exact bytes; neither language reserializes an object before
verification.

The browser keeps this opaque source envelope in `sessionStorage` and forwards
it unchanged. The scheduler verifies signature, `kid`, algorithm, issuer,
audience, timestamps, schema, size, and session correlation with an allowlisted
rotated public key; no signing secret is shipped to the browser or frontend
configuration. The anonymous beta does not maintain a replay store: a valid
`jti` can be replayed inside its 15-minute lifetime, so replay/ownership remains a
documented residual risk and results remain planning scenarios. Cross-language
golden vectors fix the exact protected-header and payload bytes, and negative
vectors cover whitespace/key-order changes, algorithm confusion, unknown `kid`,
wrong audience, expiry/skew, oversize payloads, duplicate JSON keys, and replay
outside the validity interval.

Planning choices are deliberately separate from signed academic source facts:

```text
PlanningChoices                         # browser-writable, never academic authority
  schema_version: 1
  source_envelope_sha256
  planning_session_correlation
  requested_planning_manifest_id
  acknowledged_manifest_version
  acknowledged_manifest_checksum
  scenario_acknowledged: boolean
  requirement_targets[]
    requirement_id
    progress_measure
    term_min_credits | term_min_courses | term_min_boolean
    term_priority
```

`ViewRequirements.tsx` presents the manifest/catalog-regime choice and exact
planning-scenario disclosure; `SetPreferences.tsx` collects targets and unique
priorities only for remaining requirements. The DTO cannot set source kind,
verification status, completed courses, eligibility, remaining progress,
exceptions, or policy caps. The server binds it to the exact signed envelope
digest and session correlation, resolves the requested manifest from the
owner-reviewed allowlist, checks that it matches the asserted/selected program,
and validates every target against evaluator-produced requirement IDs and the
schedule credit range. If the parser cannot establish catalog/regime facts,
`AuditParser.java` emits that fact as unavailable and the user must select a
reviewed planning manifest; the choice remains unverified.

The acknowledgment is valid only for the exact manifest version and checksum
displayed to the student. Manifest change, envelope change, expired envelope,
unknown/duplicate target, target-measure mismatch, nonunique priority, target
above remaining/policy bounds, or aggregate term minima above the schedule
maximum returns a typed error (`SCENARIO_ACKNOWLEDGMENT_STALE`,
`INVALID_PLANNING_CHOICES`, or `INFEASIBLE_TERM_TARGETS`) and no schedule. This
allows an explicit student planning choice without letting the browser invent
academic facts.

The UI obtains those stable requirement IDs through a read-only preview call,
not from parser guesses. `POST /api/academic-plans/v1/preview` accepts the signed
source envelope plus `requested_planning_manifest_id`, verifies both, evaluates
the reviewed manifest, and returns a non-authoritative
`PlanningProjectionPreview`: opaque snapshot ID, manifest label/version/checksum,
scenario disclosure, supported remaining requirement IDs/labels/measures/bounds,
and safe blocked-unknown reasons. It returns no schedule and persists nothing.
`ViewRequirements.tsx` displays that preview; after the student acknowledges the
exact version/checksum, `SetPreferences.tsx` builds targets/priorities from those
IDs. The final v2 request sends the original envelope and `PlanningChoices`, and
the server recomputes the projection and requires the manifest checksum, targets,
and envelope digest to match. The preview's snapshot ID is correlation only and
is never trusted as input. A preview is therefore
useful for the wizard but never becomes browser-authored academic authority.

After verification, a new server-side `academic_projection.py` module constructs
the same `AcademicPlanSnapshot` and `SchedulerProjection` contracts defined in
the manual-history architecture. Ordinary PDF and manual sources both remain
unverified planning inputs; only `source_kind` and source evidence differ. The
projection retains `schema_version`, `snapshot_id`, `manifest_checksum`,
`evaluation_mode`, `governing_applicability`, `scenario_acknowledged`, majors,
completed-course IDs, supported requirements, `prerequisite_eligible_course_ids`,
and `blocked_unknowns`. Each result also retains the manifest version and the
planning-scenario label. An unauthenticated upload can never become
`verified_governing` merely because parsing and signature verification succeeded.

The module selects an owner-reviewed manifest using asserted program/regime facts
and produces supported requirement projections, explicit eligible course sets,
term targets/priorities, prerequisite-eligible course IDs, and an unsupported-rule
list. It must not accept browser-supplied eligibility. The future manual-history
endpoint calls the same module with validated, explicitly unverified manual facts;
it does not introduce another scheduler or evaluator.
Any candidate course list extracted by the current DegreeWorks parser is source
evidence for comparison, not authoritative eligibility; a disagreement with the
reviewed manifest fails closed and is recorded only as a non-sensitive mismatch
count.

Expired, malformed, unknown-key, unknown-source-schema, unknown-manifest, or
unsigned envelopes return typed errors (`ACADEMIC_PROJECTION_REQUIRED`,
`ACADEMIC_PROJECTION_EXPIRED`, or `ACADEMIC_PROJECTION_INVALID`) and produce no
schedule or requirement claim. The envelope is sensitive educational data: it is
never logged, placed in URLs, or persisted server-side by this flow. Key
distribution, rotation, clocks, and failure alarms are protected infrastructure
work requiring owner approval. Rotation is overlap-safe: the signer switches to
the new `kid`, while the scheduler retains each retiring public key until every
token it could have signed has exceeded the 15-minute maximum lifetime plus
clock skew. The deployment order is mandatory: (1) publish and verify the new
scheduler public key, (2) switch the parser signer to the new `kid`, then (3)
remove the retiring verification key only after maximum token lifetime plus skew.
Removing a key early is a release-blocking configuration error.

The correlation value prevents accidental mixing inside the application but is
not authentication and cannot prevent deliberate token sharing or replay during
the short validity window. That residual anonymous-beta risk must be disclosed
and owner-approved; real ownership enforcement requires the separately protected
authentication architecture.

## Exact model changes

### `schedulingLogic/models.py`

Replace the current name/tag-oriented requirement with a deterministic,
allocation-ready value:

```python
@dataclass(frozen=True)
class SchedulingRequirement:
    requirement_id: str
    label: str
    eligible_course_ids: frozenset[CourseId]
    progress_measure: ProgressMeasure
    remaining_credits: float
    remaining_course_count: int | None
    term_min_credits: float | None
    term_min_courses: int | None
    term_min_boolean: bool
    term_target_source: TermTargetSource
    term_priority: int | None
    max_applicable_credits: float | None
    double_count_group_ids: frozenset[str]
```

These are the shared manual-history architecture fields rather than a second
allocation-only policy model. First phase accepts only `progress_measure:
CREDITS`; count targets remain in the projection so they can fail closed without
being discarded. `term_priority` is an explicit planning choice validated by the
shared evaluator, not a rank invented from the course catalog or a hard-coded
`REQUIRED`/`ELECTIVE` tier. Enum-valued fields use closed values rather than
permissive string defaults. Missing or contradictory values fail closed.

`fulfilled_by` is renamed to `eligible_course_ids` inside the domain model because
the old name is ambiguous: it means courses that *could* satisfy a remaining
rule, not courses already used to fulfill it. The server-side projection module
produces `eligible_course_ids` directly. The allocation endpoint never accepts a
browser `fulfilled_by` field; only offline migration tests retain that adapter.

Change `StudentProfile.requirements_needed` from a `set` to an ordered tuple (or
validated list). This preserves duplicate labels, deterministic request IDs, and
stable response ordering. Reject duplicate non-empty `requirement_id` values.
Carry the projection's source kind, evaluation mode, governing applicability,
scenario acknowledgment, manifest checksum/version, prerequisite-eligible course
IDs, blocked unknowns, and unavailable facts as immutable request context; do not
down-convert the shared projection into credits and course IDs only.

Use half-credit units at the encoding boundary. Do not truncate
`credits_needed` with `int()`: validate finite, non-negative multiples of 0.5 and
convert them to integer half-credit units only when building pseudo-Boolean
constraints.

Add an encoding result that owns every auxiliary-variable namespace:

```python
@dataclass
class ConstraintEncoding:
    hard: list[list[int]]
    preference_soft: list[tuple[int, list[int]]]
    allocation_indicators: dict[tuple[int, str], int]
    allocation_unit_vars: dict[tuple[int, str, int], int]
    allocation_metadata: dict[int, AllocationUnitMetadata]
    requirement_progress_vars: dict[str, int]
    day_vars: dict[Day, int]
    top_id: int
```

This replaces the current return value `(hard, soft, day_var_by_day)`. Callers
must not guess which positive model literals represent sections versus auxiliary
variables.

### `schedulingLogic/input_builder.py`

- Accept only the already signature-checked shared planning projection passed by
  the API; do not accept the browser's legacy dictionary directly.
- Enumerate the projected requirement list deterministically.
- Validate `requirement_id`, manifest version/checksum, evaluation mode,
  applicability, scenario acknowledgment, and prerequisite eligibility.
- Validate `credits_needed` without integer truncation.
- Copy the server-evaluated `eligible_course_ids` into the domain requirement.
- Validate `term_priority`, `term_target_source`, and `max_applicable_credits`
  from the shared evaluator. For first-phase credit rules, partial application of
  a final course is the defined encoder behavior rather than a browser option.
- Reject the entire Smart request when the projection contains any unsupported
  rule, duplicate ID, malformed course ID, empty eligibility, unsupported rule
  kind, or non-half-credit remaining-credit value.
- Keep the legacy `fulfilled_by` adapter outside the student-beta request path.

The API should map these failures to `UNSUPPORTED_ACADEMIC_RULES` or
`INVALID_ACADEMIC_REQUIREMENT`, not the generic database or solver error. Add
every new code to the frontend's explicit safe-message mapping and test unknown
codes fail closed.

### `schedulingLogic/candidate_builder.py`

Reuse the existing PostgreSQL section query, term filter, meeting aggregation,
and completed-course exclusion. Do **not** reuse the existing flat prerequisite
decision unchanged. Build the target course set from
`SchedulingRequirement.eligible_course_ids` plus explicitly requested
electives/courses, then intersect every degree candidate with the projection's
`prerequisite_eligible_course_ids` before section loading.

The shared evaluator may mark a course prerequisite-eligible only when its
prerequisite evidence is complete enough to establish eligibility. Unknown
transfer articulation, minimum grade, placement, permission, concurrent/corequisite,
or alternative-branch facts exclude the affected course and add a typed,
course-scoped `blocked_unknowns` reason. Malformed prerequisite identities are
not silently dropped. The existing database prerequisite list can remain a
defensive consistency check, but disagreement with the signed snapshot/manifest
fails closed with `PREREQUISITE_PROJECTION_MISMATCH`; it cannot widen the set. A
request with no remaining eligible candidate because of unknown prerequisite
facts returns `PREREQUISITE_ELIGIBILITY_UNKNOWN` and no schedule.

Stop using requirement-name tags to decide allocation. `Course.tags` may retain
catalog/display metadata, but neither candidate eligibility nor degree-progress
credit may depend on `merge_db_requirement_tags` or string equality with a
requirement label. A course's eligible requirements are derived directly from the
validated requirement objects.

The builder should emit diagnostics for:

- supported requirements with zero offered sections;
- eligible courses removed because already completed;
- courses removed by prerequisites or unavailable times; and
- candidate courses eligible for more than one requirement.

Diagnostics must contain requirement IDs and aggregate counts, not audit payloads
or student course history in logs.

## Exact MaxSAT encoding

Let `x_s` be the existing section-selection variable for section `s`. For every
supported requirement `r` and eligible section `s`, allocate a fresh indicator
`a_(s,r)` and ordered half-credit unit literals
`u_(s,r,1)..u_(s,r,N)`, where `N` is the smaller of the course-load units and
the rule's remaining units. Schedule-load credits and applied requirement credits
are separate values.

### Selection implication

An allocation unit requires its allocation indicator, and an allocation requires
the section to be selected:

```text
u_(s,r,k) -> a_(s,r) -> x_s
a_(s,r) -> u_(s,r,1)
u_(s,r,k+1) -> u_(s,r,k)
```

The prefix implication makes the represented applied-credit amount canonical:
the count of true unit literals is the number of half credits applied. A
four-credit course may therefore load four credits into the schedule while only
three credits apply to a rule with three remaining. This plan adopts
`PARTIAL_APPLICATION` for the supported credit rule; a whole-course-only rule is
a different rule kind and remains unsupported until reviewed.

For every selected degree-eligible section, require an allocation to one of its
eligible rules unless the same course was explicitly requested as a free elective:

```text
x_s -> (a_(s,r1) OR ... OR a_(s,rN))
```

The implementation must make the elective exception explicit in the input model;
it must not infer it from the absence of an allocation after solving.

### No accidental double counting

For the first phase, one selected course can allocate to at most one requirement:

```text
at_most_one(a_(s,r1), ..., a_(s,rN))
```

Do not introduce a general `allow_double_count: boolean`. Later double-counting
must be authorized by a reviewed program manifest and expressed as named policy
groups with synthetic tests. Until then, overlapping eligibility means the solver
chooses one allocation.

### Requirement term minimum and applied-credit cap

For each requirement, collect all its applied-credit unit literals as `U_r` and
convert reviewed fixed-point values into half-credit units. Define:

```text
upper_units(r) = min(
  remaining_units(r),
  max_applicable_units(r) if present else remaining_units(r)
)

sum(U_r) <= upper_units(r)
sum(U_r) >= term_min_units(r)          # only for an explicit positive target
```

Encode the cap with `PBEnc.atmost` and the target with `PBEnc.atleast`, always
passing the encoding's shared `top_id` and persisting each returned `nv` before
creating another variable. Before encoding, reject a target above
`upper_units(r)`, a target inconsistent with `progress_measure`, or aggregate
explicit minima that cannot fit the requested schedule-credit maximum with
`INFEASIBLE_TERM_TARGETS`; do not report it as solver UNSAT. This replaces
`add_requirement_credit_caps` and gives the objective's promised hard-target
stage an exact clause-level definition.

The encoding deliberately permits two or more distinct courses to allocate to the
same bucket when the upper applied-credit cap allows them, including partial
application of the final course. Existing
`add_at_most_one_section_per_course` still prevents selecting multiple sections of
one course.

For each requirement allocate a breadth literal `b_r` with a full equivalence to
its indicators:

```text
a_(s,r) -> b_r
b_r -> (a_(s1,r) OR ... OR a_(sN,r))
```

`b_r` is true exactly when that rule receives positive planned credit. These
literals provide the distinct-requirement tie-break and are recorded separately
from section and unit variables.

### Primary degree-progress objective

Every applied-credit unit contributes to the same lexicographic policy specified
by the manual-history architecture. Preference weights, department choices,
modality, time-of-day, fewer days, and fewer gaps cannot reduce an earlier
academic-policy component.

The scheduler must not invent the academic order. The shared evaluator validates
explicit term targets and student-selected `term_priority`; catalog manifests
define eligibility and policy bounds, but do not silently assign a
`REQUIRED`-before-`ELECTIVE` rank. Missing, duplicate, or contradictory priorities
make the projection unsupported.

Use staged optimization rather than undocumented large weights, and hard-fix
every complete stage before the next:

1. Enforce ordinary schedule feasibility and every explicit requirement term
   minimum/target projected by the evaluator.
2. In ascending `(term_priority, requirement_id)` order, maximize and fix progress
   for each targeted requirement. Finish and fix the entire targeted-progress
   vector before any breadth objective.
3. Maximize and fix the number of distinct **untargeted** remaining requirements
   receiving positive applied credit.
4. Maximize and fix the number of unique selected courses with positive applicable
   credit, so repeated credit units do not masquerade as broader progress.
5. Maximize and fix total applied credit, capped independently by each rule's
   remaining amount, `max_applicable_credits`, course load, and double-count policy.
6. If remaining supported requirements exist and maximum applicable progress is
   zero, return `NO_DEGREE_PROGRESS_AVAILABLE`; do not fill the schedule solely
   with unrelated courses.
7. Rebuild RC2 with all academic-policy components fixed, then optimize ordinary
   schedule preferences and generate alternatives.
8. For each chosen section set, add unit clauses that hard-fix **every** selected
   section true and every unselected candidate section false. With all earlier
   objective components still fixed, derive one canonical allocation by
   processing indicator and unit literals in stable `(targeted-first,
   term_priority-or-sentinel, requirement_id, class_num, unit_index)` order.
   Tentatively pin each true only
   when an incremental SAT check remains feasible; otherwise pin it false.

The canonical pass uses one incremental solver with assumptions rather than
rebuilding RC2 for every literal. The number of candidate allocation literals is
limited by a reviewed configuration (initial ceiling 512); exceeding it returns
`ALLOCATION_COMPLEXITY_LIMIT` rather than timing out or dropping evidence. This
final pass makes labels repeatable across runs and RC2 versions without allowing
a different section set to justify the allocation.

This makes the policy inspectable and prevents a future preference-weight change
from reducing degree progress. It also prevents equivalent overlapping
requirements from producing nondeterministic labels. If product policy later
permits a student to trade away progress, that must be an explicit user choice
and separate reviewed mode.

### Remove obsolete semantics

In `constraints_new.py`:

- delete `balance_reqs_taken` and its call;
- replace `add_requirement_credit_caps` with the allocation encoder;
- remove `len(section.course.tags)` from `build_constraints` preference weight;
- keep time conflicts, unavailable time, prerequisites, one-section-per-course,
  total credit bounds, specific-course requirements, day variables, and gap/day
  preferences; and
- return `ConstraintEncoding` rather than a tuple with an untracked auxiliary
  variable ceiling.

## Solve, decode, and independent validation

### `schedulingLogic/api.py`

Split the current single RC2 loop into named helpers:

- `_verify_source_envelope(envelope) -> AcademicPlanSnapshot`;
- `_parse_schedule_credit_bounds(ui_payload) -> ScheduleCreditBounds`;
- `_validate_planning_choices(snapshot, choices, credit_bounds) -> ValidatedPlanningChoices`;
- `_project_scheduler_input(snapshot, choices) -> SchedulerProjection`;
- `_maximize_progress_vector(encoding) -> ProgressOptimum`;
- `_build_preference_problem(encoding, optimum) -> WCNF`;
- `_solve_schedule_options(...)`;
- `_canonicalize_allocation(selected_sections, encoding, optimum)`;
- `_build_requirement_allocation_payload(...)`; and
- `_validate_allocation_contract(...)`.

Each returned schedule option includes:

```json
{
  "requirement_allocations": [
    {
      "class_num": 12345,
      "requirement_id": "req-2",
      "requirement_label": "Computer Science major electives",
      "course_load_credits": 4.0,
      "applied_credits": 3.0
    }
  ],
  "degree_progress_credits": 3.0,
  "allocation_contract_version": 1,
  "source_kind": "student_supplied_degreeworks",
  "evaluation_mode": "planning_scenario",
  "governing_applicability": "unknown",
  "scenario_acknowledged": true,
  "academic_snapshot_id": "opaque-snapshot-id",
  "manifest_version": "cs-ba-2025-v1",
  "manifest_checksum": "sha256:...",
  "scenario_label": "Planning scenario based on your selected rules; Hunter applicability not verified."
}
```

Do not put this claim in `Course.tags` or infer it later from catalog attributes.
The allocation is schedule-specific, but the canonicalization pass ensures the
same selected section set and validated planning projection always produce the
same labels.

When generating alternatives, blocking the selected section-variable set remains
correct. Decode allocations before adding the blocking clause. If the product
later wants multiple allocation explanations for the identical section set, that
is a separate behavior and needs an allocation-aware blocking policy.

Replace `OPT_MULTI_REQUIREMENT_TAG_PRIORITY` with
`DEGREE_PROGRESS_MAXIMIZED`. Include only non-sensitive aggregate counts and
credits in `optimization_details`. Every successful response must include
`allocation_contract_version: 1`; an older frontend that does not recognize the
capability must refuse import rather than silently discard required evidence.

### Deadline and performance contract

One monotonic whole-request deadline covers envelope verification, projection,
candidate loading, every academic optimization stage, preference solving,
canonicalization, decoding, and independent validation. It is computed at entry
as the smaller of `SCHEDULER_REQUEST_TIMEOUT_SECONDS` (initially the existing
18-second solver cap) and the Lambda remaining time minus a two-second response
safety margin; stages do not reset the clock. Solver helpers receive the same
deadline/cancellation token and check it between calls and before serialization.
Timeout or cancellation returns typed `SCHEDULER_TIMEOUT` with a safe stage code
and **no** schedule, allocations, or partial progress vector.

Candidate database I/O is deadline-aware rather than merely checked afterward.
`api.py` opens PostgreSQL through one helper that derives libpq
`connect_timeout` from the remaining deadline without exceeding it; if the
remaining time is below the driver's minimum usable timeout, it fails before
connecting. Immediately after connecting and before candidate work, a
transaction sets `SET LOCAL statement_timeout` and `SET LOCAL lock_timeout` from
the remaining milliseconds minus the response margin. Every candidate query uses
that transaction. Deadline cancellation invokes psycopg's safe connection cancel
mechanism where supported; all paths roll back/close in `finally`. Connection
timeout, PostgreSQL query cancellation, lock timeout, or an exhausted deadline is
normalized to `SCHEDULER_TIMEOUT` with stage `candidate_database`, never a generic
500. A disposable-PostgreSQL integration test uses `pg_sleep` and a held lock to
prove connect/query/lock budgets, cleanup, and absence of a partial response.

Release tests use catalog-sized synthetic fixtures for Computer Science,
Mathematics, and Political Science, including dense overlapping eligibility. On
the pinned CI performance profile, each fixture must be p95 at or below eight
seconds and every run at or below fifteen seconds, leaving production headroom
under the 18-second cap. Tests record candidate sections, allocation literals,
RC2/SAT invocations, stage durations, and peak memory without academic payloads.
They exercise deadline expiry and cancellation at every stage and prove no
partial response escapes. A budget regression blocks release; it is not handled
by weakening the academic objective or omitting canonicalization.

### `schedulingLogic/run_rc2.py`

Keep `decode_schedule` restricted to section literals. Add a separate decoder
that reads only `ConstraintEncoding.allocation_unit_vars`; never treat every
positive auxiliary literal as a course or allocation.

### `schedulingLogic/validate_schedule.py`

Extend the independent validator to accept decoded allocation evidence and check:

- every allocation references a selected section and known requirement;
- the course is in that requirement's explicit eligible set;
- a section is not allocated twice under the first-phase policy;
- per-requirement allocated credits independently satisfy any explicit term
  minimum and do not exceed `remaining_credits` or `max_applicable_credits` when
  that optional cap is present;
- applied credits are positive half-credit units and do not exceed either the
  course-load credits or rule's remaining credits;
- course-load credits match the selected catalog course independently of applied
  credits;
- aggregate degree-progress credits equal the decoded allocations;
- planning choices are bound to the response snapshot/manifest, acknowledgment
  version/checksum, and complete fixed objective vector; and
- when supported remaining requirements exist, a successful Smart schedule has
  positive progress and exactly matches the independently checked progress vector.

The validator must not call the encoder or trust response serialization. For
small synthetic fixtures, tests should also enumerate all feasible schedules to
prove the reported primary optimum independently of RC2.

## API and frontend impact

### Request compatibility

`src/lib/schedulePayload.ts` may keep its legacy builder only for offline migration
tests until cutover; the student-beta Smart route cannot call it. Introduce
`POST /api/schedule/v2/generate`; the existing `/api/schedule/generate` never
returns allocation contract v1. Every v2 request must send
`accepted_allocation_contract_versions: [1]`; v2 rejects a missing or incompatible
list with `ALLOCATION_CONTRACT_NOT_ACCEPTED` and never falls back. The request
contains the opaque signed source envelope, `PlanningChoices`, and UI schedule
preferences as three distinct fields. The
allocation-aware request sends the signed source-assertion envelope unchanged plus
the explicit planning-choice DTO; it does not rebuild `fulfilled_by`, remaining
progress, eligibility, or academic policy in the browser. The scheduler verifies
the envelope, then parses and validates only the narrow numeric schedule credit
bounds needed to check aggregate targets. It validates/binds choices against
those bounds before parsing the remaining ordinary schedule preferences. A
student lowering the schedule maximum below already selected targets receives
`INFEASIBLE_TERM_TARGETS`, not generic solver UNSAT. Tampering with any academic field or
session binding invalidates the signature and produces no schedule. Rollout tests
prove that an old client cannot opt into the v2 endpoint and that a new client
receiving an old-endpoint response refuses import.

### Response contract

Update all of the following together:

- `src/lib/schedulePayload.ts`: `ScheduleOption` and `ScheduleResponse` types;
- `src/lib/smartScheduleContract.ts`: validate allocation IDs, selected
  `class_num` references, finite half-credit values, totals, and per-option
  presence;
- `src/app/pages/ViewSchedules.tsx` and the planner import path: preserve the
  allocation evidence when a generated option is chosen;
- planner state: keep requirement labels and allocation evidence only in the
  current tab's in-memory React/session store, never `sessionStorage`, IndexedDB,
  a URL, or the global `hunter-schedules-v2` local-storage object; and
- selected-section details: display only the decoded requirement label allocated
  in this schedule.

Catalog attributes can remain visible as course metadata, but they must not be
shown as personalized degree progress unless the allocation payload names that
requirement. For example, a PLDI Group C attribute is not shown as fulfilled when
the student's Group C requirement was already completed or the course allocated
to another rule.

Requirement labels are educational-record data. Reloading or closing the tab,
clearing planning data, replacing the audit, or changing the anonymous planning
session deletes the in-memory attribution. A same-origin tab opened with an
opener receives no attribution because no browser storage contains it. (The
opaque signed source envelope remains in `sessionStorage` for the current upload
flow and retains that storage's documented opener-clone limitation; it never
contains generated allocations.) Tests must prove that opener-created tabs,
ordinary second tabs, reloads, and later shared-device sessions cannot recover
allocation evidence. If accounts are introduced, a
separate owner-approved server persistence and ownership design is required.

`PlanningProjectionPreview` and `PlanningChoices` also remain in the current
tab's memory only. They must not enter persisted preference state, local storage,
IndexedDB, URLs, analytics, or logs, and they are cleared with the audit/session.
Both preview and v2 responses send `Cache-Control: no-store` and the frontend
uses no service-worker cache for them.

Reload has an explicit degraded-state UI contract. Persisted schedules may keep
the existing non-sensitive `source: "degreeworks"` marker and a constant
`planning_mode: "planning_scenario"`, but never labels, allocations, progress
credits, manifest identity, or student facts. When that marker reloads without
the in-memory evidence, Planner must continue to render "Planning scenario based
on your selected rules; Hunter applicability not verified" and add
"Solver-backed degree-progress explanation was cleared; regenerate to restore
it." It must not show an unqualified "DegreeWorks suggestion" badge. Manual-only
schedules retain their existing presentation.

Manual planner edits invalidate solver attribution. Adding, removing, replacing,
or changing a section deletes the complete allocation/progress record for that
schedule and displays “Manually edited — solver-backed degree-progress
explanation was cleared.” The UI must not retain labels for apparently
unaffected sections, because the schedule-wide progress optimum and overlapping
allocations may have changed. Regeneration against a still-valid signed source
envelope is the only way to restore solver-backed labels.

The response change is capability-gated, not merely optional. A successful Smart
response without `allocation_contract_version: 1` is rejected by the new
frontend, and the new backend does not fall back when the client lacks the
capability. The frontend validator must reject an allocation that points to an
unselected section and must never reconstruct missing evidence from tags.

## File-by-file implementation sequence

| Step | Files | Required change | Gate |
| --- | --- | --- | --- |
| 1 | `parser/src/main/java/edu/hunter/watchtower/PDFParser/AuditParser.java`; `PDFController.java`; new `AcademicSourceEnvelope.java` and `AcademicSourceEnvelopeSigner.java` beside them; `parser/src/test/java/edu/hunter/watchtower/PDFParser/AuditParserTests.java`; `PDFControllerTests.java`; new signer golden-vector test; `parser/pom.xml`; `parser/src/main/resources/application.properties` | Preserve parsed major/regime assertions and explicit unavailable facts, return detached EdDSA JWS, retain unverified provenance, pin JOSE/JCS dependencies, and configure only a signing-key reference/`kid` | Owner approval of privacy and signing boundary; Java tests and Java-produced golden vectors |
| 2 | `schedulingLogic/academic_projection.py` (new); new manifest/choice models and fixtures under `schedulingLogic/`; `schedulingLogic/requirements.txt`; new `schedulingLogic/tests/test_academic_projection.py` | Verify JWS, bind/validate `PlanningChoices`, and construct the shared planning-scenario projection from owner-reviewed manifests; project prerequisite eligibility and blocked unknowns; reject stale/unsupported rules | Owner approval of academic modeling and manifest contents; Python verifies Java vectors and rejects negative vectors |
| 3 | `infrastructure/template.yaml`; `.github/workflows/deploy.yml`; parser/scheduler deployment documentation | Add protected signing/public-key references, rotation parameters, projection-preview and v2 routes, alarms, and the 18-second whole-request deadline configuration without exposing key material | Separate protected infrastructure review; no automatic merge |
| 4 | `schedulingLogic/tests/` and scheduler fixture tools | Add failing adversarial, prerequisite, policy-order, independent allocation-oracle, cancellation, and catalog-sized performance tests before solver implementation | Owner reviews expected academic semantics and explicit term-priority fixtures |
| 5 | `schedulingLogic/models.py`; `schedulingLogic/input_builder.py` | Preserve shared provenance/mode fields, stable IDs, ordered requirements, fractional remaining-credit validation, prerequisite-eligible IDs, explicit term targets/priorities, and policy caps | Targeted model/input-builder tests |
| 6 | `schedulingLogic/api.py`; `schedulingLogic/candidate_builder.py`; candidate DB integration tests | Add remaining-budget connection/statement/lock timeouts and cancellation cleanup; preserve DB loading while replacing the unsafe flat prerequisite decision and removing requirement-name tags as solver identity | Synthetic candidate tests plus disposable-PostgreSQL slow-connect/query/lock tests |
| 7 | `schedulingLogic/constraints_new.py` | Add allocation indicators/units, partial application, caps, no accidental double counting, tracked auxiliary namespace; remove pairwise tag exclusion | Clause-level and solution-level tests |
| 8 | `schedulingLogic/api.py`; `schedulingLogic/run_rc2.py` | Add the `/api/academic-plans/v1/preview` handler and `/api/schedule/v2/generate` capability/choice gate; parse credit bounds before final choice validation; add the shared deadline, staged policy optimization, exact-section canonical allocation, typed errors, `no-store`, and versioned payload | Preview/v2 API tests with mocked DB, independent oracle, timeout/cancellation, stale-choice, changed-credit-bound, cache-header, and old/new client matrix |
| 9 | `schedulingLogic/validate_schedule.py` | Independently validate allocation evidence, projection provenance, and the complete academic-policy vector | Mutation tests that corrupt every allocation/provenance field |
| 10 | `src/app/pages/UploadAudit.tsx`; `src/app/pages/ViewRequirements.tsx`; `src/app/pages/SetPreferences.tsx`; `src/app/hooks/useAuditData.ts`; `src/lib/schedulePayload.ts`; `src/lib/smartScheduleContract.ts`; `src/app/utils/clearPlanningData.ts`; `src/lib/__tests__/parserUpload.test.ts`; `src/lib/__tests__/auditReview.test.ts`; `src/lib/__tests__/smartScheduleContract.test.ts`; `src/lib/__tests__/clearPlanningData.test.ts` | Preserve the opaque source envelope, collect and bind manifest selection/scenario acknowledgment/targets/priorities, opt into v1 at v2, reject stale or partial responses, and clear all source/choice state | Frontend unit, tamper, expiry, stale-manifest acknowledgment, provenance, target/priority, and capability-matrix tests |
| 11 | `src/app/pages/ViewSchedules.tsx`; `src/lib/plannerSchedules.ts`; `src/app/pages/Planner.tsx`; `src/lib/__tests__/plannerSchedules.test.ts`; `src/lib/__tests__/plannerJourney.test.ts`; `e2e/smart-builder.spec.ts` | Keep allocation evidence in memory only, persist only the constant scenario/expired marker, show the applicability warning and solver-backed requirement, and invalidate everything on any manual edit | Accessibility plus desktop/mobile, opener-tab, reload-warning, and shared-device browser tests |
| 12 | `schedulingLogic/DEPLOYMENT.md`; API/schema documentation; release fixture | Document v2, error and evidence contracts; run the full three-major catalog-backed performance/smoke journey | Two fresh independent PR reviewers plus owner approval; protected changes remain unmerged |

Do not combine linked-component schema changes with this correction. Linked
combinations change the selectable unit from one section to a valid component
bundle and deserve a separate protected design/implementation sequence. The
allocation encoder should later consume one bundle-selection literal, but this
PR should keep the existing section unit to isolate correctness risk.

## Mandatory synthetic cases

The scheduler PR is not reviewable without all of these cases:

1. one three-credit course for one three-credit rule;
2. two distinct three-credit courses satisfying one six-credit bucket;
3. one course eligible for two rules, allocated to only one;
4. two rules with overlapping course sets and a feasible non-double-counted plan;
5. a four-credit course with three credits remaining: four schedule-load credits,
   three applied credits, and no rejection or overcount;
6. fractional 0.5, 1.5, and 2.5 remaining-credit values with integral-credit
   catalog courses, without truncation. Production `courses.credits` is currently
   `INT`; fractional course loads require a separate owner-approved schema and
   ingestion migration and are not claimed by this plan;
7. no offered eligible sections, returning a typed no-progress result;
8. all eligible sections removed by prerequisites, blocked time, or completion;
   plus transfer, grade, placement, permission, corequisite/concurrency,
   alternative-branch, and malformed-prerequisite unknowns proving candidates are
   blocked rather than silently widened;
9. a requested unrelated course that cannot displace feasible degree progress;
10. multiple optimal schedules that preserve the same progress vector, plus
    repeated runs proving canonical labels for overlapping rules;
11. malformed duplicate IDs, empty eligibility, unsupported rule kind, NaN,
    infinity, negative credits, non-half-credit values, target above
    `max_applicable_credits`, and aggregate infeasible term minima;
12. mutation tests for wrong requirement ID, wrong class number, inflated credits,
    violated explicit minimum, violated remaining/max-applicable cap, duplicate
    allocation, and an allocation to an ineligible course;
13. mixed supported/unsupported rules, including current empty major-elective,
    Writing, and Hunter Focus sets, proving the entire request fails closed;
14. cross-language fixed-byte golden vectors plus forged, expired, premature,
    wrong-audience, wrong-correlation, algorithm-confusion, unknown-key,
    noncanonical/duplicate-key, oversize, and unknown-manifest envelopes producing
    no schedule or attribution; key rotation keeps a retiring `kid` valid through
    the final pre-rotation envelope lifetime while all new envelopes use the new
    `kid`;
15. explicit term targets and term-priority fixtures proving the complete policy
    order: all targeted progress, then untargeted breadth, unique applicable
    courses, capped credits, preferences, and canonicalization; an independently
    enumerated oracle must match every component;
16. manual add/remove/replace operations invalidating all attribution; reload,
    tab-close, clear-data, direct second-tab, and opener-created-tab behavior
    proving no allocation evidence survives outside the in-memory tab state and
    the non-sensitive planning-scenario/cleared-explanation warning remains;
17. all three currently supported majors through the complete synthetic browser
    journey, including accessible requirement labels after planner import; and
18. equivalent unverified DegreeWorks assertions and validated manual facts
    producing the same `SchedulerProjection` only for the representable subset,
    while unknown manual claims produce no eligibility or fulfillment claim;
19. ordinary uploaded PDFs remaining `student_supplied_degreeworks` /
    `planning_scenario` / `governing_applicability: unknown` through response and
    UI, with the applicability warning; parser signing alone never upgrades them;
20. old-client/new-backend and new-client/old-backend combinations proving the v2
    request capability is mandatory and no side silently discards evidence;
21. exact-section canonicalization fixtures proving all selected literals are true
    and every unselected candidate is false during allocation pinning;
22. catalog-sized three-major performance fixtures meeting the p95/max budgets,
    plus deadline/cancellation injection at every stage, disposable-PostgreSQL
    slow query/held lock coverage, connection/query cleanup, and no partial
    response;
    and
23. Writing Intensive/Hunter Focus needed-state fixtures failing closed until
    section designation, residency, and course-count evidence exists; and
24. planning-choice contract negatives: envelope digest/session mismatch,
    manifest-A acknowledgment used with manifest-B/version/checksum, unknown or
    duplicate target, target-measure mismatch, duplicate priority, and browser
    attempts to supply eligibility/completion/policy fields; modifying preview
    labels/bounds or submitting IDs not present in a recomputed preview cannot
    influence the server projection; lowering the schedule maximum after target
    creation returns `INFEASIBLE_TERM_TARGETS`, and neither preview nor choices
    enters persistent storage or an HTTP cache.

Tests must inspect the actual decoded schedules and allocations. Passing the
encoder's own clauses or existing tests alone is not independent evidence.

## Rollout and approval boundary

1. Land tests and implementation in a protected PR that remains open for owner
   review even if both independent reviewers pass.
2. Run the full Python suite and the documented populated-database smoke test.
3. Run the frontend unit/build suite and serial desktop/mobile Smart Builder
   journeys for Computer Science, Mathematics, and Political Science.
4. Run keyboard-only, focus/live-region, screen-reader-label, 200% zoom, contrast,
   session-isolation, signature-tamper, expiry, and shared-device clear-data
   journeys for the new evidence and error states.
5. Deploy behind a fail-closed rollback switch. Disabling the allocation-aware
   path returns `SMART_SCHEDULER_TEMPORARILY_UNAVAILABLE` and leaves the manual
   planner available; it never restores the known-incorrect tag-based solver or
   personalized claims. Add this code to the frontend safe-message mapping.
6. Do not present the Smart Scheduler as ready until the new path passes
   production verification. The feature itself is not hidden as an experimental
   substitute for correctness.
7. Use synthetic student data for the release-tagged production journey and
   record the deployed build identity.
8. Remove the old tag-based path before inviting students; retain only the
   fail-closed disable switch as rollback.

The change is complete only when every successful Smart schedule carries
independently validated allocation evidence, feasible degree progress outranks
convenience preferences, and the UI shows only the requirement that the solver
actually allocated for that student and schedule.
