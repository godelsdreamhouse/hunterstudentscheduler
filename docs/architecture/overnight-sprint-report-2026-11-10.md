# Overnight sprint report — 2026-11-10

**Checkpoint:** 2026-11-10 01:51 America/New_York
**Merged baseline:** `0f01e02edae47747a86436f6f41816f2233eb9f9`
(PR #58)  
**Open pull requests:** PR #59, verified through the public GitHub API at this
checkpoint

This is an evidence ledger, not a claim that every historical merge followed the
subsequently required two-reviewer process. Where the retained record cannot prove
two independent reviews, the table says so explicitly.

## Current outcome

Fourteen pull requests (#45–#58) are merged into `main`. The deployed planner
route responds and serves the current catalog, but a release-tagged production
journey through the live parser and Smart Scheduler has not yet been completed.
An isolated read-only production check now proves that the CloudFront manual
planner renders 50 live Spring 2027 results on desktop and mobile and that its
same-origin catalog API returns enrollment/capacity data without 5xx responses.
The manual planner has meaningful beta improvements; Smart Scheduler correctness,
linked components, catalog completeness, privacy ingress, and operational abuse
controls remain release gates for real students.

The highest-priority corrective candidate is now fork-local PR #59. Two fresh,
independent read-only PR reviewers both returned PASS, all five GitHub checks are
complete (four success and the PR deployment job correctly skipped), and GitHub
reports the PR cleanly mergeable. It remains open because the browser bridge cannot
complete the normal GitHub merge workflow; the coordinator did not bypass that
control with a direct push to `main`. A prepared exact merge commit was not
pushed: the execution safeguard rejected a default-branch direct push as an
unsafe bypass of the normal PR control and potential production deployment.
Two fresh, independent read-only post-merge reviews of
PR #58 found two release-blocking defects; both reviewers passed the corrected
branch after the correction and deterministic re-verification loop. A post-merge
review can find regressions and justify a correction, but it does not retroactively
satisfy a pre-merge gate or replace the required reviews of an actual corrective PR.

## Deployed and merged changes

- The planner no longer crashes on catalog-result shape drift and now has a
  type-checking gate.
- Audit review has a visible, accessible continuation action.
- Manual schedules expose detailed selected-section information and retain
  generated schedule imports.
- Students can hide truly full sections, clear browser-local planning data, use
  readable removable filters, select exact credit ranges, and load live
  undergraduate department options.
- Coursedog discovery is documented and hardened; required CI paths run on PRs.
- Oversized DegreeWorks uploads receive safe user-facing errors.
- Smart Scheduler browser data is validated before planner storage is mutated.

These statements describe merged source. They do not by themselves prove that the
corresponding production deployment or backing data has passed the full beta gate.

The merged local-preview workflow was also re-exercised from the exact PR #59
stack: `npm run build` succeeded, strict port 4173 correctly refused to start
because it was occupied, the documented explicit fallback on 4174 started, and a
request to `http://127.0.0.1:4174/planner` returned the compiled SPA with HTTP
200. The preview server was then stopped. This verifies inspection without a
merge or deployment; it does not substitute for the blocked production browser
journey.

## Unmerged candidate queue

| Priority | Candidate | Revision | Verified local evidence | Merge / approval status |
| --- | --- | --- | --- | --- |
| P0 corrective | PR #59: PR #58 request/import lifecycle hardening | `8e5dc503728f4efc41664b8ecab2a7057f6b9d9b` | Fresh PR Reviewer A: PASS after 77/77 tests, type-check, build, 12/12 browser journeys, repeated cancellation checks, and an independent mutation probe. Fresh PR Reviewer B: PASS after the same core suite plus independent nested-PII injection checks on desktop/mobile. GitHub: four required checks succeeded; deploy skipped by PR design. | Fork-local PR #59 is open, cleanly mergeable, and production-safe; normal PR merge remains blocked by the browser-control session. No owner-protected area changed. |
| P0 | Structured catalog attributes and bounded scrape runtime | `c360bad` stacked on PR #59 | Fresh SQLx-backed Rust suite passes 23/23 against a disposable PostgreSQL 18 schema; Rust formatting and 4/4 workflow runner-network tests pass. | Clean branch `fix/structured-attributes-pr59` is pushed; no PR yet. It needs two fresh PR reviewers and remains owner-gated because it changes production ingestion/workflow behavior. No production scrape or data promotion was run. |
| P0 | Parser temporary-audit cleanup and conservative upload boundary | `c6fc027` stacked on PR #59 | 17/17 targeted Java privacy/upload tests; 78/78 frontend tests; type-check; production build; all 12 desktop/mobile Smart Builder journeys pass | Clean branch `fix/parser-audit-cleanup-pr59` is pushed; no PR yet. It needs two fresh PR reviewers and remains owner-gated because it changes sensitive audit-data handling and the production upload boundary. |
| P0 | Student beta and upload-privacy disclosure | `dd13449` stacked on PR #59 | 77/77 unit tests; type-check; production build; all 14 desktop/mobile Smart Builder journeys pass, including the pre-upload beta/privacy disclosure check | Clean branch `feature/student-beta-notice-pr59` is pushed; no PR yet, so it needs two fresh PR reviewers. No protected area changed. |
| P0 research | Linked-section lossless normalizer prototype | `aea0caa` stacked on PR #59 | 46/46 tests pass: 13 discovery-capture and 33 linkage/ambiguity/quarantine tests. Diff is limited to the source-data analysis document and prototype/test scripts. | Clean branch `research/linked-section-normalizer-pr59` is pushed; no PR yet. Research only: no scheduler, schema, scraper production path, or application behavior changed. Any integration remains owner-gated. |
| P0/P1 | Planner layout and attribute presentation | `7762239` stacked on PR #59 | 77/77 frontend unit tests; type-check; production build; all 14 desktop/mobile Smart Builder journeys pass. The dedicated regression proves document scrolling, no selected-list scroll trap, and no planning-disclosure/clear-control overlap. | Clean branch `fix/planner-layout-attributes-pr59` is pushed; no PR yet, so it needs two fresh PR reviewers. Attribute labels remain presentation only and do not cure missing source attributes. No protected area changed. |
| P1 | Manual-planner department filter | `fa69714` stacked on PR #59 | 78/78 frontend unit tests; type-check; production build; 13/13 backend tests; all 12 desktop/mobile Smart Builder journeys pass | Clean branch `feature/planner-department-filter-pr59` is pushed; no PR yet, so it needs two fresh PR reviewers. Uses the existing active-undergraduate department list and exact parameterized filtering; it does not claim graduate or degree-program filtering. No schema or scheduler changes. |
| P1 privacy/testing | Manual persistence/export regression and complete planning-data clearing | `0c553c1` stacked on PR #59 | 78/78 frontend unit tests; type-check; production build; all 16 desktop/mobile planner and Smart Builder journeys pass serially. The browser test exposed and the change fixes deletion-order behavior that could leave a selected schedule in Chrome storage while other keys were removed. | Clean stacked branch `fix/planning-data-cleanup-pr59` is pushed; no PR yet, so it needs two fresh PR reviewers after PR #59 merges. No protected area changed. |
| P1 testing | Require synthetic browser journeys in frontend CI | `50f3d71` stacked on PR #59 | 77/77 unit tests; type-check; production build; all 12 existing desktop/mobile Chrome journeys pass. The Playwright install command resolves successfully in dry-run mode, and changes under `e2e/` or `playwright.config.ts` now trigger the push-side workflow path filter. | Clean branch `test/frontend-browser-ci-pr59` is pushed; no PR yet, so it still needs two fresh PR reviewers. It deliberately adds the browser suite to the existing required `test` job rather than a separate non-required job. CI/workflow approval remains with the owner. |
| P1 / major UX | Preference wizard plus Smart Builder theme persistence | `c844238` stacked on PR #59 | 83/83 frontend unit tests; type-check; production build; all 16 desktop/mobile Smart Builder, wizard, and theme journeys pass. Integration preserves both stylesheet rule sets and updates the complete three-major journey to advance through all four steps. | Clean branch `feature/preference-wizard-theme-pr59` is pushed; no PR yet. Major UX remains owner-gated and needs two fresh PR reviewers. No scheduler or schema changes. |
| P2 research | Manual Academic History architecture | `57bbfcb` stacked on PR #59 | The sole document blob is identical to independently reviewed `2b46a2c`; prior technical-feasibility and academic/privacy architecture reviews passed. | Clean branch `docs/manual-history-architecture-pr59` is pushed; no PR yet, so fresh PR reviewers are still required. Architecture only: no scheduler, schema, or application behavior changed. |
| P0 protected architecture | Smart Scheduler requirement-allocation change plan | `a86f69a8452fbd277c5cb968f3163433b8294c1b` stacked on PR #59 | Fresh independent technical and product/academic reviewers initially returned CHANGES REQUIRED, independently re-reviewed the corrected design, then both returned final PASS after narrow sign-off. The plan now defines shared unverified planning projections, fail-closed prerequisite eligibility, exact term-minimum/cap clauses, solver-backed allocations, preview/choice binding, signature/key rotation, deadline-bounded DB/solver work, memory-only attribution, capability gating, performance tests, and rollback behavior. | Clean branch `docs/scheduler-allocation-plan-pr59` is pushed; no implementation changed and no PR exists yet. Every future scheduler, academic-model, schema, key-management, or infrastructure implementation remains owner-gated and must receive two fresh PR reviews. |
| Release evidence | Beta-readiness assessment and anonymous threat model | `8c513291c74df0c25cb9397ba8d679cb5b560ccb` plus this report | Source-path audit, production/API observations, and reproduced scheduler adversarial cases documented | No PR; documentation candidate; still requires two fresh PR reviewers |

## Merge queue dependency audit

All normalized candidate heads have PR #59's exact head (`8e5dc50`) as their
merge base. An isolated temporary-clone merge simulation established the first
production-safe queue as:

1. merge PR #59;
2. open and review `fix/planning-data-cleanup-pr59`;
3. open and review `feature/student-beta-notice-pr59`; and
4. rebase `fix/planner-layout-attributes-pr59` onto those merges before opening
   it.

The first two candidates merge together automatically. The layout candidate then
has a single content conflict in `e2e/smart-builder.spec.ts`; its Planner source
and stylesheet merge automatically. That test conflict must be reconciled without
dropping either candidate's assertions, followed by the full frontend and serial
desktop/mobile browser suite before the layout PR enters its two-reviewer gate.
The department-filter candidate merged automatically after the layout candidate
in a second isolated simulation. Protected ingestion, parser/privacy, and major-UX
candidates remain outside this automatic queue regardless of textual mergeability.

## PR verification table

“Not retained” means the current coordinator can prove the merge and exact
revision from GitHub, but cannot prove the required independent reviewer outcome
from surviving records. It must not be interpreted as a pass.

| PR | Title | Implementation agent | Reviewer A | Reviewer B | Issues identified / corrections made | Final test evidence retained | Merge status | Owner approval required? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #45 | Fix planner catalog-result crash and add typechecking | Historical agent identity not retained (`fix/planner-render-crash`) | Not retained | Not retained | Reviewer record unavailable | Not independently reconstructable | Merged as `cef834c` | No protected area identified |
| #46 | Document isolated local UI previews | Historical agent identity not retained (`local-ui-preview-docs`) | Not retained | Not retained | Reviewer record unavailable | Not independently reconstructable | Merged as `89fb4c0` | No protected area identified |
| #47 | Test generated schedule import persistence | Historical agent identity not retained (`generated-schedule-import-test`) | Not retained | Not retained | Reviewer record unavailable | Not independently reconstructable | Merged as `5add198` | No protected area identified |
| #48 | Make audit review continuation visible and accessible | Historical agent identity not retained (`fix/audit-review-cta`) | **PASS** | **PASS** after two correction rounds | Reviewer B found missing dialog semantics/focus trap/Escape/background suppression, mobile action overflow, then missing focus restoration. Implementation moved to Radix dialog, responsive stacking, explicit close autofocus, and a stable focus target. | Reviewer B: `git diff --check`, type-check, 12 unit tests, build, generated-CSS and Radix source verification. Browser creation failed, so no interactive browser pass was claimed. Reviewer A's exact command ledger was not retained. | Merged as `69f40f5` | No protected area identified |
| #49 | Show complete details for selected planner sections | Historical agent identity not retained (`feature/selected-section-details`) | Not retained | Not retained | Reviewer record unavailable | Not independently reconstructable | Merged as `c1f01a3` | No protected area identified |
| #50 | Document and harden Coursedog section discovery | Historical agent identity not retained (`coursedog-section-discovery`) | Not retained | Not retained | Reviewer record unavailable | Not independently reconstructable | Merged as `7f24cc5` | Owner review prudent for production-data ingestion; actual retained approval evidence unavailable |
| #51 | Run required verification checks on every PR | Historical agent identity not retained (`fix/required-pr-check-paths`) | Not retained | Not retained | Reviewer record unavailable | Not independently reconstructable | Merged as `7a4e617` | Production CI/workflow change; owner-approval record unavailable |
| #52 | Let students clear browser-local planning data | Historical agent identity not retained (`feature/clear-planning-data`) | Not retained | Not retained | Reviewer record unavailable | Not independently reconstructable | Merged as `bc7b46c` | Privacy-sensitive behavior; approval record unavailable |
| #53 | Let students hide only truly full sections | Historical agent identity not retained (`feature/hide-full-sections`) | Not retained | Not retained | Reviewer record unavailable | Not independently reconstructable | Merged as `fd1df28` | No protected area identified |
| #54 | Test the complete Smart Builder browser journey | Historical agent identity not retained (`smart-builder-browser-e2e`) | Not retained | Not retained | Reviewer record unavailable | Historical fixture is now stale against PR #58; corrected candidate passes 10/10 locally | Merged as `0c62588` | No protected implementation change identified |
| #55 | Make planner filters readable and removable | Historical agent identity not retained (`feature/planner-filter-chips`) | Not retained | Not retained | Reviewer record unavailable | Not independently reconstructable | Merged as `2958de4` | No protected area identified |
| #56 | Use exact credit ranges and live department options | Historical agent identity not retained (`fix/credit-range-inputs`) | Not retained | Not retained | Reviewer record unavailable | Not independently reconstructable | Merged as `7118930` | No protected area identified |
| #57 | Return safe, usable errors for oversized DegreeWorks uploads | Historical agent identity not retained (`fix/parser-upload-errors`) | Not retained | Not retained | Reviewer record unavailable | Not independently reconstructable | Merged as `14dd11f` | Privacy-sensitive boundary; approval record unavailable |
| #58 | Validate Smart Scheduler data before importing it | Historical agent identity not retained (`feature/smart-schedule-api-contract`) | **CHANGES REQUIRED → corrective branch PASS** | **CHANGES REQUIRED → corrective branch PASS** | Both reviewers independently reproduced stale schedule import/redirect after leaving generation. Reviewer A also found arbitrary extra browser-stored student fields were forwarded to the scheduler. Reviewer B found 8/10 checked-in browser tests stale. Corrective head `8e5dc50` allowlists the outgoing academic payload, aborts/suppresses post-unmount completion, repairs fixtures, and adds deterministic desktop/mobile race coverage that first proves the delayed request is in flight. | Initial Reviewer A: build and diff-check. Initial Reviewer B: 76/76 unit tests, type-check, build; 2/10 browser tests passed before correction. Coordinator: 77/77 unit tests, type-check, build, 12/12 browser tests, then 2/2 deterministic race rechecks. Re-review A: 77/77 unit tests, build, diff-check, plus final six-line diff-check. Re-review B: 77/77 unit tests, type-check, build, 12/12 serial browser tests, independent delayed-response reproduction, and 2/2 final deterministic race tests. | Merged defect remains in `0f01e02`; corrective PR #59 is open and independently verified | No protected code changed; behavior is beta-critical |
| #59 | Fix Smart Schedule contract hardening | Coordinator (`fix/smart-schedule-contract-hardening`) | **PASS** | **PASS** | No blocking findings. Both reviewers independently checked the explicit academic payload allowlist, unmount/abort lifecycle, deterministic in-flight navigation regression, three-major flows, and protected-area diff boundary. | Reviewer A: 77/77 tests, type-check, build, 12/12 browser journeys, 6/6 repeated cancellation runs, adversarial mutation probe, diff-check. Reviewer B: 77/77 tests, type-check, build, 12/12 browser journeys, independent nested-field injection on desktop/mobile. GitHub checks re-queried at 01:33: parser, scheduler validity, frontend test, and verify succeeded; PR deploy skipped. | Open and cleanly mergeable; normal merge unavailable through current browser bridge. The execution safeguard rejected an exact direct-main push, so no repository or deployment state changed. | No |

## PRs without provable two-reviewer verification

The retained evidence does **not** prove two independent pre-merge reviews for PRs
#45–#47 or #49–#58. PR #48 is the only merged PR for which two independent final
pre-merge outcomes can currently be reconstructed. PR #58's new reviews are
post-merge and therefore remain separate from its original merge gate. Open PR
#59 does have two fresh independent PR reviews.

## Verified findings and blockers

1. The Smart Scheduler can reject a valid two-course requirement because courses
   sharing a requirement tag are pairwise excluded.
2. It enforces only maximum tagged credits, not minimum degree-progress coverage;
   an unrelated course can satisfy the term target. Fixing this requires a
   protected scheduler change and owner review.
3. Linked instructional components cannot be represented safely as a single
   lecture-to-single-lab relation. Source associations include multiple
   alternatives, more component types, polymorphic requirement declarations,
   and sparse directed auto-enrollment links.
4. Production PHILO 23000 is missing its official PLDI Group C attribute. The
   scraper/runtime candidate is not yet proven by a hosted three-term run.
5. The baseline 5 MiB audit file can exceed the synchronous Lambda envelope after
   API Gateway base64 wrapping. The conservative 4 MiB candidate still needs a
   deployed near-boundary test.
6. Anonymous parser and scheduler endpoints have a weak abuse boundary. Per-route
   throttles, reserved concurrency, alarms, and an explicit residual-risk decision
   are protected infrastructure work requiring owner approval.
7. The browser bridge is connected to the correct Chrome profile and enumerates
   the Hunter Scheduler PR and production tabs, but currently fails with an
   internal `timeoutMs` error when attaching to either tab. Toggling the extension
   and resetting the control session did not cure the attach failure. Retained
   local session logs reproduce the same attach/new-tab failure across multiple
   sessions beginning November 5, so the evidence does not support a repository,
   GitHub-login, or per-tab permission cause. This blocks
   interactive production verification until the bridge is repaired; it does not
   block source, API, or isolated automated verification.
8. Fork-local PR creation succeeded, but the current browser bridge still cannot
   drive GitHub's normal merge control. PR #59 is therefore left open despite two
   PASS reviews and green checks. A direct-main push was prepared from the exact
   reviewed head but rejected by the execution safeguard because it would bypass
   GitHub's merge control and could trigger production; it was not retried. The
   accidental upstream parent PR #113 is closed and was not merged.
9. The current CloudFront response blocks the external Google Fonts stylesheet
   under its content-security policy, so the planner uses fallback fonts. This did
   not prevent either production layout from rendering. The mobile planning-aid
   disclosure is reachable after switching from Course Search to Schedule, but is
   not visible in the initial mobile pane.
10. Audit requirement statuses remain read-only. The current flat parser contract
    cannot safely implement a two-way status toggle: completed entries contain the
    course already used, whereas still-needed entries contain eligible choices.
    Treating a browser toggle as authoritative would either offer a taken course or
    invent an academically unsupported `fulfilled_by` set. The safe implementation
    depends on the source-neutral snapshot and trusted evaluator described in the
    Manual Academic History architecture; it does not require a parallel scheduler.

## Next actions

1. Merge PR #59 through GitHub's normal PR control, then verify the resulting
   deployment and rerun the live production planner journey.
2. Open the structured-ingestion, parser-cleanup, disclosure, planner-privacy,
   and beta-readiness PRs; then run two fresh reviewers per PR before any merge.
3. Merge only independently approved, production-safe work. Keep scheduler,
   schema, infrastructure, academic interpretation, and major UX changes open for
   owner review.
4. Present the independently reviewed allocation architecture at revision
   `a86f69a` for owner decisions before creating any protected implementation PR.
5. Run the hosted three-term scrape into a guarded staging path, verify completeness
   and official attributes, then verify production only after approved promotion.
6. Execute a release-tagged desktop/mobile production journey using synthetic data
   after the browser path and deployed version identity are available.
7. After the review queue is stable, migrate from the public fork to a private,
   standalone repository with history, branches, tags, checks, secrets, and remote
   protections explicitly inventoried. Do not perform that operational migration
   mid-review or without owner approval.
