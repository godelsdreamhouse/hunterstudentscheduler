# Overnight sprint report — 2026-11-10

**Checkpoint:** 2026-11-09 23:05 America/New_York  
**Merged baseline:** `0f01e02edae47747a86436f6f41816f2233eb9f9`
(PR #58)  
**Open pull requests:** none, verified through the public GitHub API at this
checkpoint

This is an evidence ledger, not a claim that every historical merge followed the
subsequently required two-reviewer process. Where the retained record cannot prove
two independent reviews, the table says so explicitly.

## Current outcome

Fourteen pull requests (#45–#58) are merged into `main`. The deployed planner
route responds and serves the current catalog, but a release-tagged production
journey through the live parser and Smart Scheduler has not yet been completed.
The manual planner has meaningful beta improvements; Smart Scheduler correctness,
linked components, catalog completeness, privacy ingress, and operational abuse
controls remain release gates for real students.

The highest-priority unmerged candidates are implemented and locally checked, but
none has an open PR yet. Consequently none is eligible to merge and none counts as
independently PR-verified. PR #58 is undergoing two fresh, independent read-only
post-merge reviews because the retained evidence did not prove that its original
merge received the required pair. A post-merge review can find regressions and
justify a correction, but it does not retroactively satisfy a pre-merge gate.

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
| P0 corrective | PR #58 request/import lifecycle hardening | `7e73ca9` | Coordinator: 77/77 frontend unit tests, type-check, production build, and 12/12 desktop/mobile Chrome journeys. Reviewer A: PASS WITH NOTES. Reviewer B: PASS after independently replaying the race and all 12 browser journeys. | Branch pushed; no PR yet, so these branch reviews do not satisfy the mandatory PR-review gate and it is not eligible to merge |
| P0 | Structured catalog attributes and bounded scrape runtime | `8adc4831377dfc2603cc6e4cdd9775ebcdd06962` | 23/23 Rust library tests; 4/4 workflow runner-network tests; formatting check | No PR; needs two PR reviewers and owner approval because it changes production ingestion/workflow behavior |
| P0 | Parser temporary-audit cleanup and conservative upload boundary | `3b2c9212f6d22bf476751bd4ab53cd7a29817796` | 17/17 targeted parser tests; 4/4 frontend upload tests; type-check and build | No PR; needs two PR reviewers and owner approval because it handles sensitive audit data |
| P0 | Student beta and upload-privacy disclosure | `fb6bf321bd1e56fb0ec3d45c3880f129ed89d047` | 76/76 unit tests; type-check and build; targeted pre-upload disclosure test passes desktop/mobile (2/2) | No PR; needs two PR reviewers |
| P0 | Linked-section lossless normalizer prototype | `dd1a99afb567d8ee4ef7a21a4f8b7dc13e34a8f4` | 46/46 synthetic tests | No PR; prototype only. Representation/schema integration requires owner review; do not merge into production schema or scheduler |
| P0 | Smart Builder contract-valid browser fixtures | `dc14d9041fd5177c2a3b575a890cbcbd13704ae7` | 10/10 desktop/mobile synthetic journeys | No PR; needs two PR reviewers; production E2E remains separate |
| P0/P1 | Planner layout and attribute presentation | `4fb9b7f56ab7f56932936e7bc3a7536016f09094` | Candidate exists; current checkpoint has not revalidated its full test ledger | No PR; must be rebased/rechecked after catalog-data direction is settled |
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
| #58 | Validate Smart Scheduler data before importing it | Historical agent identity not retained (`feature/smart-schedule-api-contract`) | **CHANGES REQUIRED → corrective branch PASS WITH NOTES** | **CHANGES REQUIRED → corrective branch PASS** | Both reviewers independently reproduced stale schedule import/redirect after leaving generation. Reviewer A also found arbitrary extra browser-stored student fields were forwarded to the scheduler. Reviewer B found 8/10 checked-in browser tests stale. Corrective branch `7e73ca9` allowlists the outgoing academic payload, aborts/suppresses post-unmount completion, repairs fixtures, and adds desktop/mobile race coverage. Reviewer A's only remaining note is to make the browser regression explicitly wait for mock-request receipt before navigating; it found the production guard correct. | Initial Reviewer A: build and diff-check. Initial Reviewer B: 76/76 unit tests, type-check, build; 2/10 browser tests passed before correction. Coordinator: 77/77 unit tests, type-check, build, 12/12 browser tests. Re-review A: 77/77 unit tests, build, diff-check. Re-review B: 77/77 unit tests, type-check, build, 12/12 serial browser tests, targeted desktop/mobile race, and independent delayed-response reproduction. | Merged defect remains in `0f01e02`; corrected branch is pushed, but no corrective PR exists yet | No protected code changed; behavior is beta-critical |

## PRs without provable two-reviewer verification

The retained evidence does **not** prove two independent pre-merge reviews for PRs
#45–#47 or #49–#58. PR #48 is the only merged PR for which two independent final
pre-merge outcomes can currently be reconstructed. PR #58's new reviews are
post-merge and therefore remain separate from its original merge gate.

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
7. The browser bridge can enumerate Chrome tabs but currently fails when creating
   a task tab with an internal `timeoutMs` error. This blocks interactive production
   verification until a task-relevant tab is manually opened or the bridge is
   repaired; it does not block source, API, or isolated automated verification.
8. No authenticated GitHub write path is available to the coordinator in this
   environment. Candidate branches are pushed, but PR creation still requires an
   authenticated browser or CLI/API session.

## Next actions

1. Finish both independent post-merge reviews of PR #58 and create a narrowly
   scoped corrective branch if either finds a blocking regression.
2. Open the structured-ingestion, parser-cleanup, disclosure, browser-fixture,
   and beta-readiness PRs; then run two fresh reviewers per PR before any merge.
3. Merge only independently approved, production-safe work. Keep scheduler,
   schema, infrastructure, academic interpretation, and major UX changes open for
   owner review.
4. Run the hosted three-term scrape into a guarded staging path, verify completeness
   and official attributes, then verify production only after approved promotion.
5. Execute a release-tagged desktop/mobile production journey using synthetic data
   after the browser path and deployed version identity are available.
