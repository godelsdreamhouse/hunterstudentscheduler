# Overnight sprint report — 2026-11-10

**Checkpoint:** 2026-11-10 00:15 America/New_York
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
control with a direct push to `main`. Two fresh, independent read-only post-merge reviews of
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

## Unmerged candidate queue

| Priority | Candidate | Revision | Verified local evidence | Merge / approval status |
| --- | --- | --- | --- | --- |
| P0 corrective | PR #59: PR #58 request/import lifecycle hardening | `8e5dc503728f4efc41664b8ecab2a7057f6b9d9b` | Fresh PR Reviewer A: PASS after 77/77 tests, type-check, build, 12/12 browser journeys, repeated cancellation checks, and an independent mutation probe. Fresh PR Reviewer B: PASS after the same core suite plus independent nested-PII injection checks on desktop/mobile. GitHub: four required checks succeeded; deploy skipped by PR design. | Fork-local PR #59 is open, cleanly mergeable, and production-safe; normal PR merge remains blocked by the browser-control session. No owner-protected area changed. |
| P0 | Structured catalog attributes and bounded scrape runtime | `c360bad` stacked on PR #59 | Fresh SQLx-backed Rust suite passes 23/23 against a disposable PostgreSQL 18 schema; Rust formatting and 4/4 workflow runner-network tests pass. | Clean branch `fix/structured-attributes-pr59` is pushed; no PR yet. It needs two fresh PR reviewers and remains owner-gated because it changes production ingestion/workflow behavior. No production scrape or data promotion was run. |
| P0 | Parser temporary-audit cleanup and conservative upload boundary | `c6fc027` stacked on PR #59 | 17/17 targeted Java privacy/upload tests; 78/78 frontend tests; type-check; production build; all 12 desktop/mobile Smart Builder journeys pass | Clean branch `fix/parser-audit-cleanup-pr59` is pushed; no PR yet. It needs two fresh PR reviewers and remains owner-gated because it changes sensitive audit-data handling and the production upload boundary. |
| P0 | Student beta and upload-privacy disclosure | `dd13449` stacked on PR #59 | 77/77 unit tests; type-check; production build; all 14 desktop/mobile Smart Builder journeys pass, including the pre-upload beta/privacy disclosure check | Clean branch `feature/student-beta-notice-pr59` is pushed; no PR yet, so it needs two fresh PR reviewers. No protected area changed. |
| P0 | Linked-section lossless normalizer prototype | `dd1a99afb567d8ee4ef7a21a4f8b7dc13e34a8f4` | 46/46 synthetic tests | No PR; prototype only. Representation/schema integration requires owner review; do not merge into production schema or scheduler |
| P0 | Smart Builder contract-valid browser fixtures | `dc14d9041fd5177c2a3b575a890cbcbd13704ae7` | 10/10 desktop/mobile synthetic journeys | No PR; needs two PR reviewers; production E2E remains separate |
| P0/P1 | Planner layout and attribute presentation | `7762239` stacked on PR #59 | 77/77 frontend unit tests; type-check; production build; all 14 desktop/mobile Smart Builder journeys pass. The dedicated regression proves document scrolling, no selected-list scroll trap, and no planning-disclosure/clear-control overlap. | Clean branch `fix/planner-layout-attributes-pr59` is pushed; no PR yet, so it needs two fresh PR reviewers. Attribute labels remain presentation only and do not cure missing source attributes. No protected area changed. |
| P1 | Manual-planner department filter | `fa69714` stacked on PR #59 | 78/78 frontend unit tests; type-check; production build; 13/13 backend tests; all 12 desktop/mobile Smart Builder journeys pass | Clean branch `feature/planner-department-filter-pr59` is pushed; no PR yet, so it needs two fresh PR reviewers. Uses the existing active-undergraduate department list and exact parameterized filtering; it does not claim graduate or degree-program filtering. No schema or scheduler changes. |
| P1 privacy/testing | Manual persistence/export regression and complete planning-data clearing | `0c553c1` stacked on PR #59 | 78/78 frontend unit tests; type-check; production build; all 16 desktop/mobile planner and Smart Builder journeys pass serially. The browser test exposed and the change fixes deletion-order behavior that could leave a selected schedule in Chrome storage while other keys were removed. | Clean stacked branch `fix/planning-data-cleanup-pr59` is pushed; no PR yet, so it needs two fresh PR reviewers after PR #59 merges. No protected area changed. |
| P1 | Smart Builder theme persistence | `6d62c2741e01faecacb400096c87bf97bd43c0fd` | Candidate exists | No PR; conflicts with preference-wizard branch and must not be independently merged without reconciliation |
| P1 / major UX | Preference wizard | `2ae8e80844bd39d2980a718f915c86e4794f358e` | Candidate exists | No PR; major UX requires owner review and conflicts with theme branch |
| P2 research | Manual Academic History architecture | `2b46a2c627ef74c34fa1d57daffdc348f444a93a` | Architecture technical and academic/privacy reviews passed before PR creation | No PR; architecture only; fresh PR reviews still required; no scheduler/schema behavior changed |
| Release evidence | Beta-readiness assessment and anonymous threat model | `8c513291c74df0c25cb9397ba8d679cb5b560ccb` plus this report | Source-path audit, production/API observations, and reproduced scheduler adversarial cases documented | No PR; documentation candidate; still requires two fresh PR reviewers |

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
| #58 | Validate Smart Scheduler data before importing it | Historical agent identity not retained (`feature/smart-schedule-api-contract`) | **CHANGES REQUIRED → corrective branch PASS** | **CHANGES REQUIRED → corrective branch PASS** | Both reviewers independently reproduced stale schedule import/redirect after leaving generation. Reviewer A also found arbitrary extra browser-stored student fields were forwarded to the scheduler. Reviewer B found 8/10 checked-in browser tests stale. Corrective head `8e5dc50` allowlists the outgoing academic payload, aborts/suppresses post-unmount completion, repairs fixtures, and adds deterministic desktop/mobile race coverage that first proves the delayed request is in flight. | Initial Reviewer A: build and diff-check. Initial Reviewer B: 76/76 unit tests, type-check, build; 2/10 browser tests passed before correction. Coordinator: 77/77 unit tests, type-check, build, 12/12 browser tests, then 2/2 deterministic race rechecks. Re-review A: 77/77 unit tests, build, diff-check, plus final six-line diff-check. Re-review B: 77/77 unit tests, type-check, build, 12/12 serial browser tests, independent delayed-response reproduction, and 2/2 final deterministic race tests. | Merged defect remains in `0f01e02`; corrected branch is pushed, but no corrective PR exists yet | No protected code changed; behavior is beta-critical |
| #59 | Fix Smart Schedule contract hardening | Coordinator (`fix/smart-schedule-contract-hardening`) | **PASS** | **PASS** | No blocking findings. Both reviewers independently checked the explicit academic payload allowlist, unmount/abort lifecycle, deterministic in-flight navigation regression, three-major flows, and protected-area diff boundary. | Reviewer A: 77/77 tests, type-check, build, 12/12 browser journeys, 6/6 repeated cancellation runs, adversarial mutation probe, diff-check. Reviewer B: 77/77 tests, type-check, build, 12/12 browser journeys, independent nested-field injection on desktop/mobile. GitHub checks: parser, scheduler validity, frontend test, and verify succeeded; PR deploy skipped. | Open and cleanly mergeable; normal merge unavailable through current browser bridge. Direct-main push was not used. | No |

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
7. The browser bridge can enumerate Chrome tabs and creates a blank task tab, but
   currently fails with an internal `timeoutMs` error when returning or attaching
   to that tab. Toggling the extension and resetting the control session did not
   cure the attach failure. This blocks interactive production verification until
   the bridge is repaired; it does not block source, API, or isolated automated
   verification.
8. Fork-local PR creation succeeded, but the current browser bridge still cannot
   drive GitHub's normal merge control. PR #59 is therefore left open despite two
   PASS reviews and green checks. The accidental upstream parent PR #113 is closed
   and was not merged.
9. The current CloudFront response blocks the external Google Fonts stylesheet
   under its content-security policy, so the planner uses fallback fonts. This did
   not prevent either production layout from rendering. The mobile planning-aid
   disclosure is reachable after switching from Course Search to Schedule, but is
   not visible in the initial mobile pane.

## Next actions

1. Merge PR #59 through GitHub's normal PR control, then verify the resulting
   deployment and rerun the live production planner journey.
2. Open the structured-ingestion, parser-cleanup, disclosure, planner-privacy,
   and beta-readiness PRs; then run two fresh reviewers per PR before any merge.
3. Merge only independently approved, production-safe work. Keep scheduler,
   schema, infrastructure, academic interpretation, and major UX changes open for
   owner review.
4. Run the hosted three-term scrape into a guarded staging path, verify completeness
   and official attributes, then verify production only after approved promotion.
5. Execute a release-tagged desktop/mobile production journey using synthetic data
   after the browser path and deployed version identity are available.
6. After the review queue is stable, migrate from the public fork to a private,
   standalone repository with history, branches, tags, checks, secrets, and remote
   protections explicitly inventoried. Do not perform that operational migration
   mid-review or without owner approval.
