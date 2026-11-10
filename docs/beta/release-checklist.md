# Satisfi student-beta release checklist

This checklist turns the beta reviews into release gates. It does not authorize
production changes; items marked **review required** need owner approval before
merge or execution. Use synthetic audit data only.

## 1. Merge and deployment gates

Review the open changes independently before merging:

1. **PR #39 — no-login backend (review required: authentication and
   infrastructure).** Account and session routes become fail-closed by default.
2. **PR #40 — catalog attributes (review required: academic data).** Published
   attributes keep PLDI/WRIC and omit College Option.
3. **PR #41 — read-only audit review (review required: academic workflow).**
   Students can no longer move requirements between Completed and Still Needed.
4. **PR #42 — exact parser CORS origin (review required: infrastructure and
   security).** The desired Lambda environment uses only Satisfi's CloudFront
   origin.
5. **PR #43 — major-program research and this checklist.** Documentation only.

Every merge to `main` starts the automatic deployment workflow. Merge only one
reviewed change at a time, or deliberately batch approved merges and allow the
workflow's concurrency control to cancel superseded deployments. Before moving
to production verification, require the newest `main` run to show:

- verification passed;
- Lambda image builds passed;
- frontend upload passed;
- deployment passed; and
- all deployed smoke-test steps passed.

Stop if verification fails. Do not manually dispatch a deployment merely to
work around a failed required check.

## 2. No-login production gate

After PR #39 deploys:

- `/api/health` returns `200`;
- `/api/catalog/terms` remains public;
- `/api/users/profile` returns exactly `404`, not `401`;
- registration, login, logout, profile, OAuth start, and OAuth callback paths
  under `/api/users/*` all return `404`; and
- the planner, parser, and scheduler health checks still pass.

The deployment smoke test covers the profile-route assertion. Check the other
account paths with requests that contain no real identity or password data.

## 3. Spring 2027 catalog gate

PR #40 does not update stored catalog data by itself. After approval and merge,
run one controlled manual Scrape workflow for Spring 2027. This operation can
delete rows that the source explicitly marks cancelled, so it is a
review-required production-data action.

Before accepting the result:

- the workflow build and scrape jobs succeed;
- `/api/catalog/terms` includes Spring 2027;
- PHILO 23000 contains `PLDI - GROUPC (Group C)` and
  `WRIC - WRIC (Writing Intensive)`;
- College Option is absent from `/api/catalog/attributes` and section details;
- the five-course sample in `catalog-correctness.md` still matches Hunter;
- explicitly cancelled sections are absent;
- active and tentative sections remain;
- TBA sections do not contain invented all-day meetings;
- multiple named instructors and waitlist counts survive ingestion; and
- a failed attribute-enrichment request is investigated rather than silently
  accepting incomplete attributes.

Do not claim source freshness from `courses.last_updated`; section-level source
timestamps are not currently stored.

## 4. DegreeWorks and solver gate

After PR #41 deploys, use synthetic audits for each supported major: Computer
Science, Mathematics, and Political Science.

For each fixture:

1. compare every parsed completed and still-needed item with its expected data;
2. confirm review rows are read-only and explicitly labeled;
3. confirm the saved scheduler request preserves the parser's original
   Completed/Still Needed partition;
4. generate schedules with credit bounds, blocked times, requested courses, and
   modality preferences;
5. independently inspect the returned sections for conflicts and constraint
   compliance; and
6. remove or replace a generated section in the manual planner, reload, and
   export the edited schedule.

Stop if an unsupported major is silently mapped to a supported program, a
requirement disappears, or a generated schedule violates a hard constraint.
Satisfi remains planning assistance, not an official degree audit.

## 5. Parser privacy and CORS gate

Merging PR #42 does not apply the CloudFormation template. After its separate
stack update is reviewed and applied:

- the parser Lambda environment contains the exact origin
  `https://d263b17wgkx1dd.cloudfront.net`;
- the Satisfi origin receives the expected parser response;
- a different CloudFront origin does not receive an allow-origin response;
- the same-origin upload path still works; and
- health checks remain green.

In a non-production environment, use synthetic PDFs to verify:

- files above 5 MB and renamed non-PDF files are rejected;
- responses and framework errors do not expose filenames, audit text, stack
  traces, or parser internals;
- successful and failed uploads leave no temporary audit file;
- parser responses use `Cache-Control: no-store`;
- closing the tab clears session-scoped audit data; and
- legacy persistent audit keys are removed.

Do not paste audit contents, tokens, student identifiers, or sensitive logs into
an issue or pull request.

## 6. Student journey gate

Run at desktop and phone widths against the deployed beta:

- search by course code, title, instructor, and course attribute;
- combine open-only, modality, day, attribute, and hidden-conflict filters;
- add and remove sections from results and the calendar;
- verify duplicate-course and time-conflict messages;
- create, rename, switch, persist, and delete multiple schedules;
- export an `.ics` file and import it into Google Calendar plus Apple or
  Outlook Calendar; and
- edit a Smart Builder result through the same manual-planner controls.

The automated frontend tests cover the underlying journey rules, but they do
not replace this deployed browser walkthrough.

## 7. Usability and accessibility gate

Test current Chrome, Safari, and Firefox with:

- keyboard-only navigation and visible focus;
- VoiceOver or NVDA announcements for tabs, loading, conflicts, empty results,
  expanded details, and errors;
- browser zoom at 200%;
- widths down to 320 px;
- high-contrast/forced-colors mode; and
- popup/download restrictions during calendar export.

Also confirm upload/review modal focus containment and restoration. A student
must be able to understand calendar content without relying on color alone.

## Known limitations to disclose

- Smart Builder supports only Computer Science, Mathematics, and Political
  Science; the manual planner supports the broader catalog.
- Linked lecture/recitation associations are not yet modeled.
- Upstream section disappearance is not reconciled unless the source explicitly
  reports cancellation.
- Published major rules cannot represent transfer decisions, substitutions,
  waivers, repeats, residency, double-counting, or student-specific exceptions.
- The parser and solver remain anonymous public services protected by global
  throttling rather than per-user authorization.

Do not call the beta student-ready until every applicable gate above has a
recorded result and each stop condition is resolved or explicitly accepted.
