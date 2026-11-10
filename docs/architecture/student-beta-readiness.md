# Student beta readiness assessment

**Assessment date:** 2026-11-09

**Scope:** the three currently supported majors, DegreeWorks-driven Smart
Scheduler, and the public manual section planner. Psychology and generalized
major support are explicitly out of the beta critical path.

This document is a release assessment, not authorization to change the Python
scheduler, production schema, authentication architecture, deployment
configuration, or academic-rule interpretation.

The supporting [anonymous student-beta threat model](anonymous-beta-threat-model.md)
records the verified data flow, abuse cases, and privacy-specific release
evidence in greater detail.

## Candidate baseline and evidence ledger

The integration baseline for this assessment is immutable commit
`0f01e02edae47747a86436f6f41816f2233eb9f9` (the fetched
`godelsdreamhouse/hunterstudentscheduler` `main`, containing PR #58). Statements
described as current behavior refer to that commit unless another revision is
named. The following immutable but unmerged revisions are evidence or proposed
changes; none is silently treated as part of the candidate, and none counts as
PR-verified until two fresh read-only PR reviewers sign off:

| Evidence | Immutable revision | Status in this assessment |
| --- | --- | --- |
| PR #59 Smart Schedule contract and lifecycle correction | `8e5dc503728f4efc41664b8ecab2a7057f6b9d9b` | Open fork-local PR; two fresh independent reviewers returned PASS, 77/77 tests/type-check/build and 12/12 desktop/mobile browser journeys passed, and all non-deploy GitHub checks succeeded. It is not part of the baseline until merged. |
| Structured catalog attributes, completeness guards, and scrape runtime bounds | `c360bad` stacked on PR #59 | Unmerged owner-gated implementation/workflow candidate. Its candidate files are byte-identical to previously tested `8adc483` (23/23 scraper tests); fresh formatting and 4/4 runner-network tests pass. A fresh SQLx compile awaits a disposable PostgreSQL build database. |
| Full Coursedog section discovery and linkage prototype | `dd1a99afb567d8ee4ef7a21a4f8b7dc13e34a8f4` | Unmerged, non-production prototype awaiting PR review; 46/46 synthetic tests passed |
| Smart Builder contract-valid browser fixtures | `dc14d9041fd5177c2a3b575a890cbcbd13704ae7` | Unmerged tests-only correction awaiting PR review; 10/10 desktop/mobile browser journeys passed after the PR #58 contract change |
| Student beta and audit-privacy disclosures | `dd13449` stacked on PR #59 | Unmerged UI candidate awaiting PR review; type-check, 77/77 unit tests, production build, and all 14 desktop/mobile Smart Builder journeys passed, including confirmation that the disclosure appears before upload and the beta notice persists in planner flows |
| Manual-planner department filter | `fa69714` stacked on PR #59 | Unmerged manual-planner candidate awaiting PR review; type-check, 78/78 frontend unit tests, production build, 13/13 backend tests, and all 12 desktop/mobile Smart Builder journeys passed. This uses the existing active-undergraduate department endpoint and does not claim graduate or degree-program filtering. |
| Planner schedule layout and attribute-label presentation | `7762239` stacked on PR #59 | Unmerged UI candidate awaiting PR review; type-check, 77/77 frontend unit tests, production build, and all 14 desktop/mobile journeys passed. The dedicated regression proves whole-page schedule scrolling and separation of the planning disclosure from the clear-data control; label formatting does not replace missing source attributes. |
| Manual-planner persistence/export and clear-data regression | `0c553c1` stacked on PR #59 | Unmerged candidate awaiting PR review; type-check, 78/78 unit tests, production build, and all 16 desktop/mobile planner and Smart Builder journeys passed. The check exposed and fixes storage-key iteration that could leave a schedule behind when Chrome reordered keys during deletion. Playwright is not currently a required GitHub check. |
| DegreeWorks audit cleanup and Lambda-safe upload boundary | `c6fc027` stacked on PR #59 | Unmerged owner-gated parser/privacy candidate awaiting PR review; 17/17 targeted Java privacy/upload tests, 78/78 frontend tests, type-check, production build, and all 12 desktop/mobile Smart Builder journeys passed. Coverage includes exact/oversized multipart limits and a forced unlink failure. The legacy full parser suite still requires database seed data and local PDF fixtures that are not present in this checkout. |
| Manual Academic History architecture | `2b46a2c627ef74c34fa1d57daffdc348f444a93a` | Unmerged documentation only; architecture reviewers passed it, but fresh PR review is still required; not a beta dependency |

PR #50's read-only discovery tool, PR #51's required-check correction, PR #57's
parser upload-boundary hardening, and PR #58's Smart Scheduler request/response
validation are included in this baseline. The scheduler findings were
reproduced from its ancestor `0c625884` in an isolated Python environment using
`schedulingLogic/requirements.txt`; neither merged PR changes scheduler code:

- `PYTHONPATH=schedulingLogic python -m unittest discover -s schedulingLogic/tests -v`
  passed 19/19 tests;
- a two-course, six-credit, non-overlapping synthetic schedule solved and passed
  the independent response validator;
- a six-credit requirement with two eligible three-credit courses returned
  `UNSAT`; and
- with a three-credit requirement and three-credit schedule target, assumptions
  that excluded the eligible course and selected an unrelated course returned
  `SAT`.

Production observations are point-in-time evidence, not candidate contents. On
2026-11-09 (America/New_York), all five GitHub checks for `0f01e02` completed
successfully, including deployment, verification, frontend tests, scheduler
validity, and parser build. The deployed `/planner` returned HTTP 200 and rendered
Spring 2027 sections with enrollment counts. A later isolated read-only Playwright
run against `https://d263b17wgkx1dd.cloudfront.net/planner` rendered 50 live
results in both desktop and Pixel 7 layouts; the same-origin API returned ten
representative Spring 2027 sections with enrollment and capacity fields, and the
browser observed no unhandled first-party request failure or 5xx response. The
planning-aid disclosure was initially visible on desktop and reachable after
switching to the Schedule pane on mobile. The production CSP blocked the external
Google Fonts stylesheet, so fallback fonts were used, and one redundant initial
desktop catalog request was aborted before the successful request completed. The
public catalog reported Spring 2027 and Fall 2026 terms and 92 distinct Spring
2027 attribute strings. This was a read-only production planner check, not an
end-to-end production Smart Builder run against the live parser and scheduler.
The deployed services expose no authoritative build SHA, so a health or UI
response alone cannot prove which revision is serving after a later deployment.

The latest scheduled scrape run (`42629635066`) failed in `Run scrape` after the
step consumed approximately its full 60-minute timeout; build and network-gate
jobs succeeded, and post-scrape verification did not run. Job-log download was
not available anonymously, so timeout is a strong timing inference rather than
a quoted log diagnosis. The run is recorded in
[GitHub Actions](https://github.com/godelsdreamhouse/hunterstudentscheduler/actions/runs/42629635066).
The weekly workflow requests 9,472 courses across three default terms, or 28,416
course-term section calls; a prior two-term run already took 59m21s before HTML
attribute enrichment was added. Unmerged candidate `8adc483` removes that HTML
fan-out in favor of guarded structured attributes, rate-limits retries, bounds
connections and request attempts, reports phase timing, and raises the scrape
and job budgets to 105 and 115 minutes within the 120-minute AWS session. Only a
hosted three-term run can prove that revised operational budget.

The live Spring 2027 API currently returns only WRIC for PHILO 23000. Hunter's
[official PHILO 23000 catalog record](https://hunter-undergraduate.catalog.cuny.edu/courses/0316711)
lists both `PLDI - GROUPC` and `WRIC`; this is a concrete production-data defect,
not an inference from the display label.

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
| Catalog attributes and academic labels | Production PHILO 23000 currently returns only `WRIC - WRIC`, while Hunter's official catalog lists both WRIC and `PLDI - GROUPC`. Candidate `8adc483` passes 23/23 scraper tests with structured-attribute source and completeness guards, but is unmerged and has not populated production. | Merge only after two independent reviews and owner approval of the academic-data and workflow impact; run a complete guarded staging scrape; compare representative official catalog records; promote atomically; then verify production API and planner labels. |
| Catalog freshness and reconciliation | The latest scheduled scrape failed in `Run scrape` after approximately the full 60-minute step timeout, so its post-scrape verification never ran. The default run fans out 9,472 courses across three terms. Candidate `8adc483` removes the later HTML fan-out, bounds requests, logs phase timing, and budgets 105 minutes for the scrape, but its hosted runtime is unproven. Production still serves Spring 2027 data, but freshness and completeness are not proven by that response. | Independently review and owner-approve the runtime candidate, then prove a full three-term scrape completes within its operational envelope. Require complete-term volume guards, explicit cancellation/stale-record policy, atomic promotion, and post-run representative checks. A partial run must never become the served catalog. |
| Audit upload ingress boundary | The baseline UI and Spring parser accept a 5 MiB PDF and a 6 MB multipart request. Production uses API Gateway payload v2.0 with synchronous Lambda invocation. A 5 MiB binary expands to about 6.67 MiB under base64 before event-wrapper overhead, likely exceeding Lambda's 6 MB synchronous request limit even though HTTP API Gateway accepts 10 MB. Candidate `3b2c921` aligns the UI and Spring file limit at 4 MiB and caps the full multipart request at 4,400 KiB; exact and oversized Tomcat-boundary tests pass. | Independently review and merge the conservative limit, then prove accepted and rejected near-boundary PDFs through the deployed API Gateway/Lambda path. Confirm against the official [HTTP API quota](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-quotas.html) and [Lambda payload limit](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html). |
| Private audit handling | Baseline `0f01e02` enforces upload limits, validates a PDF signature, returns generic processing failures, applies `no-store`, deletes temporary PDFs in `finally`, and has targeted parser privacy/upload tests. Deletion failure remains silently ignored and can retain a raw audit in a warm runtime. Unmerged candidate `3b2c921` makes cleanup failure observable without logging a path or payload, truncates before a failed-unlink retry, protects active parses from expiry races, and removes stale `audit-*.pdf` files on the next upload after five minutes; 17/17 targeted parser tests pass, including a forced unlink failure that verifies the raw bytes are truncated. This is best-effort next-request cleanup, not an absolute five-minute deletion guarantee. The browser posts directly to anonymous Java and Python endpoints and stores normalized audit data in tab `sessionStorage`. | Independently review and merge the cleanup candidate; publish a concise upload privacy/retention disclosure that accurately describes best-effort cleanup; prohibit audit payload logging; verify clear-data and tab-close behavior; retain the explicit threat review of the approved anonymous-beta boundary in release decisions. |
| Production identity and abuse boundary | Baseline `0f01e02` exposes parser and scheduler routes without an authorizer and leaves the raw execute-api endpoint enabled. Both expensive 1536 MB Lambdas share only a stage-wide 5 requests/second, burst-10 throttle; a scheduler call may run for 18 seconds. The browser calls these services directly. No cross-student retrieval path or server-side audit persistence was found, but one script can cheaply monopolize capacity and cost. | Explicitly approve the residual anonymous-beta denial-of-service risk or introduce authenticated proxying. For anonymous beta, add stricter per-route throttles, reserved concurrency, cost/concurrency/throttle alarms, malformed/compressed-PDF tests, non-identifying planning-session identifiers, and prominent clear-data behavior. For authenticated beta, verify session ownership at every academic-record and scheduler boundary. |
| Student-facing beta and privacy disclosure | The production build has only a small planner footnote. Candidate `7fec33a` adds a persistent beta notice to both planner shells and explains temporary parsing, tab-local extracted audit facts, longer-lived browser storage for preferences/times/schedules, shared-computer clearing, and the prohibition on uploading another student's audit. | Merge after independent review and verify the expanded copy on deployed desktop/mobile routes; add a feedback and incident-contact path before invitations are sent. |
| Production observability and rollback | Deployment has health smoke tests, 14-day Lambda/API logs, concurrency protection, and a production deploy check. No CloudWatch alarms or safe deployed-version endpoint are defined in the infrastructure template. | Add alarms for parser/scheduler/API errors and latency without logging student payloads; document alert owner and rollback command; expose a non-sensitive version identifier and prove rollback in staging. Infrastructure changes require owner review. |
| End-to-end production proof | The production manual planner and live catalog pass an isolated desktop/mobile read-only journey with 50 rendered Spring 2027 results and no unhandled first-party request failure or 5xx response. All checks on `0f01e02` are green. The repaired synthetic Smart Builder suite passes 10/10 locally, but the fixture correction is unmerged and no release-tagged journey has exercised the live parser, live scheduler, and current catalog together. | A release-tagged production Smart Builder journey using non-identifying synthetic audit data, real current-term catalog sections, linked components, mobile and desktop layouts, and a deployment SHA/version endpoint. |

### P0B — additional gates that must pass before real students

| Area | Current state | Exit condition |
| --- | --- | --- |
| Requirement attribution | Smart results do not yet have solver-backed allocation evidence. Course attributes alone cannot establish that a course is advancing a particular student's remaining rule. | Decode explicit requirement-allocation variables and return stable requirement IDs/labels; show only allocations that apply to this student and this schedule. |
| Full-section handling | Production manual planner has a `Hide full sections` toggle and displays enrollment/max enrollment while leaving full sections visible by default. | Verify the same user choice and seat counts across Smart results, linked combinations, zero-capacity/TBA cases, and mobile. Keep full sections available when the toggle is off. |
| Selected-section details | Production manual planner lists selected course, component, section, class number, credits, meetings, instructor, modality, and enrollment. The synthetic Smart Builder journey verifies imported schedule details and persistence after its fixture correction. | Production browser verification for imported Smart schedules, multiple meetings, TBA fields, linked combinations, and mobile layout. |
| Failure recovery | PR #58 validates stored setup and scheduler responses before planner mutation and maps known service errors to safe user messages. Catalog, parser, and scheduler availability can still fail independently. | User-actionable retry states for every service; no silent fallback to preview data in production; correlation IDs that do not contain student data; browser tests for timeouts and malformed responses. |
| Accessibility | Local desktop/mobile journeys pass after the tests-only fixture correction, but this is not a complete accessibility audit. | Keyboard-only workflow, visible focus, dialog focus containment/return, semantic error announcements, contrast, 200% zoom, and screen-reader checks on upload review, preferences, planner, and results. |
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
untrusted. Baseline `0f01e02` has CORS restrictions, parser upload/body limits,
generic parser errors, `no-store` responses, API Gateway throttling, tab-local
normalized audit storage, and an explicit browser-data clear control. Those are
meaningful controls, but they do not replace a reviewed privacy boundary. For an
anonymous beta:

- never persist the raw PDF;
- do not log PDF content, parsed audit payloads, GPA, completed courses, or
  requirement lists;
- do not use a student EMPLID as the anonymous planning identifier;
- apply upload/body limits, rate limits, CORS restrictions, and abuse controls;
- keep normalized academic data tab-local and provide an obvious complete-clear
  control; and
- disclose what leaves the browser, that the raw PDF is intended to be temporary,
  what remains in the tab, and how closing the tab or clearing data removes it.

At the verified baseline, the original PDF and filename are not saved in browser
storage. Normalized audit facts remain in `sessionStorage` for the tab session,
while preferences, blocked times, selected/generated schedules, and course
choices remain in `localStorage` until explicitly cleared. This is especially
important on shared computers and must be stated before upload, not only inside
the later clear-data dialog.

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
   sections, TBA meetings, and linked alternatives. Exercise accepted and
   rejected upload sizes through API Gateway/Lambda, plus compressed/malformed
   PDFs that are cheap to submit but expensive to parse.
5. Record exact release SHA, test fixtures, expected outputs, and reviewer
   outcomes in the release checklist.

## Recommended order of work

1. Repair the scrape runtime/staging path, merge the structured catalog ingestion
   candidate after independent review, and complete a guarded staging scrape.
   Verify official attributes—including PHILO 23000—before promoting data.
2. Independently review and merge the parser cleanup candidate with a concise
   upload privacy disclosure before real audit uploads.
3. Approve the linked-component representation and production-schema proposal;
   then implement staging/reconciliation separately from planner consumption.
4. Prepare the protected scheduler correction with the failing synthetic tests
   and exact allocation contract. Keep it open for owner review.
5. Add student-facing requirement attribution only after allocation correctness
   is proven.
6. Merge and deploy the beta notice, add a feedback path, and configure
   privacy-safe operational alerts with an identified incident owner.
7. Run the release-tagged production verification and resolve every P0 and P0B
   gate.
8. Invite real students only after the owner records the go/no-go decision and
   rollback owner.

The beta decision should be based on these gates, not a coverage percentage or
green health endpoint alone.
