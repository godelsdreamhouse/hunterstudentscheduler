# Student beta readiness assessment

**Assessment date:** 2026-11-09  
**Scope:** the three currently supported majors, DegreeWorks-driven Smart
Scheduler, and the public manual section planner. Psychology and generalized
major support are explicitly out of the beta critical path.

This document is a release assessment, not authorization to change the Python
scheduler, production schema, authentication architecture, deployment
configuration, or academic-rule interpretation.

## Executive decision

The manual planner is suitable for a limited student beta after the catalog
freshness, linked-component, privacy, and production-observability gates below
are met. The Smart Scheduler is **not ready to be represented as producing a
degree-progress-valid schedule**. Its ordinary schedule construction works in
synthetic validation, but two independently reproducible constraint defects can
reject a valid multi-course requirement or accept a schedule that advances none
of the student's modeled remaining requirements.

The recommended beta boundary is:

1. Keep the Smart Scheduler visible and continue developing it; do not call the
   overall product ready until its correctness gates pass.
2. Do not create a parallel scheduling engine. Correct and validate the existing
   MaxSAT requirement semantics under the protected-code review boundary.
3. Continue shipping independently safe manual-planner and data-quality work.
4. Limit academic claims to the three reviewed majors and show which exact
   requirement allocation was validated for every Smart Scheduler course.

## Release gates

### P0 — must pass before real students

| Gate | Current evidence | Required proof |
| --- | --- | --- |
| Smart Scheduler requirement correctness | The scheduler unit suite passes 19/19 and a normal two-course synthetic schedule solves. However, the two adversarial cases below reproduce correctness failures. | Protected solver change reviewed by the owner; synthetic tests for multi-course buckets, minimum coverage, overlapping eligibility, double counting, no-candidate cases, and unsatisfiable targets; full scheduler suite and catalog-backed smoke pass. |
| Linked instructional components | Read-only Fall 2027 capture found 4,514 sections, 14 component types, 75 association groups with multiple lab/discussion/recitation/clinical/tutorial alternatives, and sparse explicit auto-enroll links. A lossless fail-closed prototype passes 46/46 tests but is not integrated. | Approved representation and schema; staged scraper reconciliation; planner and scheduler consume valid combinations rather than independent component records; browser tests cover alternatives and auto-enrollment. |
| Catalog freshness and reconciliation | Structured course-attribute ingestion is independently reviewed and passes 22/22 scraper library tests. The current production path does not yet prove atomic stale/cancelled-section reconciliation. | Complete-term staging run with volume/completeness guardrails; explicit cancellation and stale-record policy; atomic commit; post-run counts and representative section checks. |
| Private audit handling | The reviewed parser branch deletes temporary PDFs immediately, returns generic processing failures, applies no-store responses, and passes 13/13 tests. The browser still posts directly to anonymous Java and Python endpoints and stores normalized audit data in tab `sessionStorage`. | Deploy and verify immediate deletion; define the approved anonymous-beta privacy boundary or introduce authenticated proxying; prohibit audit payload logging; verify clear-data/tab-handoff behavior and documented retention. |
| Production identity | Current `origin/main` exposes upload, requirements, preferences, and schedules without an authenticated route. Express account routes are feature-gated and the browser calls parser/scheduler directly. | Product decision and threat review for anonymous beta versus authenticated beta. If anonymous, use non-identifying planning-session identifiers, no server persistence, rate limiting, abuse controls, and prominent clear-data behavior. If authenticated, verify session ownership at every academic-record and scheduler boundary. |
| End-to-end production proof | Controlled browser journeys passed for Smart Builder and manual planner, and all four service health endpoints returned HTTP 200. Health does not prove catalog correctness or the deployed commit. | A release-tagged production journey using synthetic audit data, real current-term catalog sections, linked components, mobile and desktop layouts, and a deployment SHA/version endpoint. |

### P1 — required for a trustworthy beta experience

| Area | Current state | Exit condition |
| --- | --- | --- |
| Requirement attribution | Smart results do not yet have solver-backed allocation evidence. Course attributes alone cannot establish that a course is advancing a particular student's remaining rule. | Decode explicit requirement-allocation variables and return stable requirement IDs/labels; show only allocations that apply to this student and this schedule. |
| Full-section handling | Manual planner has a `Hide full sections` toggle and displays enrollment/max enrollment. | Verify the same user choice and seat counts across Smart results, linked combinations, zero-capacity/TBA cases, and mobile. Keep full sections available when the toggle is off. |
| Selected-section details | Manual planner lists selected course, component, section, class number, credits, meetings, instructor, modality, and enrollment. | Production browser verification for imported Smart schedules, multiple meetings, TBA fields, and mobile layout. |
| Failure recovery | Client timeouts and response-shape handling exist, but service health and catalog availability can fail independently. | User-actionable retry states for parser, scheduler, and catalog failures; no silent fallback to preview data in production; correlation IDs that do not contain student data. |
| Accessibility | Desktop/mobile browser journeys passed, but this is not a complete accessibility audit. | Keyboard-only workflow, visible focus, dialog focus containment/return, semantic error announcements, contrast, 200% zoom, and screen-reader checks on upload review, preferences, planner, and results. |
| Academic boundary | DegreeWorks-derived `fulfilled_by` data drives candidates; prerequisites are flattened and therefore cannot faithfully represent all alternatives, minimum grades, permissions, placement, or concurrency. | Clearly label planning assistance; fail closed on unknown eligibility; test the exact supported rule subset for Computer Science, Mathematics, and Political Science; document unsupported rule forms. |

### P2 — may continue without delaying the three-major beta

- Manual Academic History architecture and synthetic evaluator work, provided it
  reuses the shared academic representation and existing MaxSAT engine.
- Psychology BA and generalized-major source-data research in isolated,
  read-only prototypes.
- Course-first planner redesign exploration, provided major UX changes remain
  unmerged until approved.
- Cross-device persistence, substitutions, waivers, transfer articulation, and
  catalog-year automation after their academic and privacy policies are agreed.

## Reproduced Smart Scheduler blockers

These are implementation defects in `schedulingLogic/constraints_new.py`, not
merely missing tests.

### 1. Valid multi-course requirement becomes unsatisfiable

`balance_reqs_taken` adds pairwise exclusion clauses for every pair of sections
sharing a requirement tag. In a synthetic profile needing six credits from a
single bucket, two eligible non-overlapping three-credit courses therefore
produce `UNSAT`. A multi-course bucket must allow multiple distinct courses up
to its actual academic and per-term limits.

### 2. No minimum requirement coverage is enforced

`add_requirement_credit_caps` uses `PBEnc.atmost`; it limits how many tagged
credits may be selected but never requires any minimum coverage. In a profile
requiring one tagged three-credit course with a three-credit schedule target,
forcing the required course off and an unrelated course on remains `SAT`.

These defects interact: removing the pairwise exclusion without adding explicit
minimum/allocation semantics would fix one failure while preserving the other.
The correction should introduce explicit course-to-requirement allocation,
separate remaining degree progress from a student's per-term target, and decode
the allocations used for student-facing explanations. Convenience preferences
must not trade away the validated degree-progress target.

## Verified source-data constraints for linked sections

The section scraper must not assume that linked work consists only of one
lecture plus one lab, discussion, or recitation.

- Linkage is scoped by course, term, `sessionCode`, and `associatedClass`.
- One association can offer many alternatives of the same component type.
- The source declared 14 component types, including clinical, field studies,
  independent study, internship, message, practicum, research, seminar, thesis
  research, and tutorial.
- `registrationMode` identifies enrollment versus non-enrollment sections.
- `_classAssociation.CLASS_COMPONENT` declares required/optional components and
  is polymorphic: object, array, or absent.
- `autoEnrollSect1` and `autoEnrollSect2` are stronger directed evidence when
  present, but appeared on too few sections to be the primary grouping method.
- Missing or contradictory association evidence must quarantine the affected
  group instead of inventing a combination.

Before integration, the staged database representation must preserve the raw
source payload, normalized component declarations, one-to-many instructors and
meetings, explicit auto-enroll links, source lifecycle status, and scrape-run
completeness metadata. This requires schema approval and must not be slipped into
a routine scraper PR.

## Privacy and security boundary

The current browser-facing architecture is intentionally low-friction but has a
weak trust boundary:

```text
browser -> Java /AuditParse
browser -> Python /api/schedule/generate
browser -> Express catalog routes
```

React route gating is not authorization. Java and Python must treat all browser
fields—including the planning-session identifier and requirement payload—as
untrusted. For an anonymous beta:

- never persist the raw PDF;
- do not log PDF content, parsed audit payloads, GPA, completed courses, or
  requirement lists;
- do not use a student EMPLID as the anonymous planning identifier;
- apply upload/body limits, rate limits, CORS restrictions, and abuse controls;
- keep normalized academic data tab-local and provide an obvious complete-clear
  control; and
- document that closing a tab and clearing data are part of the privacy model.

If accounts are enabled, parser and scheduler calls should move behind an
authenticated Express boundary. The server—not the browser—must bind records to
the authenticated user. This is a separate architecture approval and is not a
prerequisite to isolated synthetic work.

## Exact readiness verification plan

### Scheduler

1. Add failing synthetic tests for both reproduced defects before changing the
   constraints.
2. Add allocation tests for one course eligible for multiple rules, allowed and
   forbidden double counting, course-count versus credit rules, partial progress,
   explicit-course requests, and impossible term targets.
3. Run the complete Python suite in an isolated environment.
4. Run the documented scheduler smoke test against a populated synthetic or
   staging catalog; an empty database does not count.
5. Independently validate every returned schedule against the input facts rather
   than trusting the solver's own serialization.

### Scraper and linked components

1. Re-run full-field discovery for the target beta term.
2. Compare source totals, section totals, statuses, component distributions, and
   attribute population with reviewed floors.
3. Load into staging and prove a partial or malformed run performs zero
   destructive reconciliation.
4. Validate representative standalone, multiple-alternative, multi-component,
   auto-enroll, cancelled, tentative, and quarantined groups.
5. Only then promote atomically and verify planner/scheduler API responses.

### Product and production

1. Expose a safe build/version identifier from each deployed service.
2. Execute desktop and mobile journeys against that version using synthetic
   student data.
3. Verify upload review, visible Continue action, preference entry, generation,
   selected-section details, requirement attribution, manual edits, export, and
   clear-data behavior.
4. Repeat with service failures, malformed PDFs, no eligible sections, full
   sections, TBA meetings, and linked alternatives.
5. Record exact release SHA, test fixtures, expected outputs, and reviewer
   outcomes in the release checklist.

## Recommended order of work

1. Publish and deploy the already reviewed parser privacy and structured catalog
   ingestion changes.
2. Approve the linked-component representation and production-schema proposal;
   then implement staging/reconciliation separately from planner consumption.
3. Prepare the protected scheduler correction with the failing synthetic tests
   and exact allocation contract. Keep it open for owner review.
4. Add student-facing requirement attribution only after allocation correctness
   is proven.
5. Run the release-tagged production verification and resolve every P0 gate.
6. Invite real students with a beta notice, a feedback path, and an incident
   rollback owner.

The beta decision should be based on these gates, not a coverage percentage or
green health endpoint alone.
