# DegreeWorks Workflow Beta Review

This review used repository fixtures and synthetic payloads only. No real audit,
student identifier, production credential, or production database was accessed.

## Current flow

1. The browser accepts a PDF up to 10 MB and posts it to `/AuditParse`.
2. The Java parser writes the upload to a generated temporary filename, parses
   it, and attempts to delete the temporary file in a `finally` block.
3. The browser presents the parsed requirements and stores the confirmed,
   normalized payload in browser-local storage.
4. Preferences are combined with that payload and posted to
   `/api/schedule/generate` with a random browser-local planning identifier.
5. Generated schedule options are converted to the manual planner's section
   shape, saved locally, and opened in `/planner`, where sections can be removed,
   replaced, renamed, and exported.

## Automated verification added

- The scheduler test suite now includes a synthetic contract test covering the
  normalized parser payload, preferences, unavailable times, completed courses,
  remaining requirements, elective selection, and requested courses.
- Unsupported majors are asserted to fail explicitly instead of silently being
  translated into a different program.
- The existing academic workflow now compiles the Java parser and its test
  sources in GitHub Actions in addition to the scheduler validity suite.

## Beta safeguard awaiting review

The audit-review modal previously let a student toggle a parsed requirement
between `Completed` and `Still Needed`. Confirming the modal moved the underlying
requirement between the parser response lists before building the scheduler
payload. A student could therefore remove a requirement from scheduling without
evidence of a completed course or grade.

The proposed beta safeguard makes these statuses read-only, preserves the parser
response exactly when building the scheduler payload, and directs students to
upload a current audit when the displayed result is wrong. A future correction
workflow would need a clearly labeled override, provenance, validation rules,
and an advising disclaimer. Because this changes an established academic
workflow, it remains unmerged pending owner review.

## Supported-program limitation

The parser documentation and scheduler model currently support Computer Science,
Mathematics, and Political Science. The scheduler deliberately rejects other
majors. The Smart Builder should not be advertised as supporting all Hunter
programs until the program mapping and requirement logic are expanded and
academically verified. The manual planner remains available regardless of major.

## Verification and blockers

- `PYTHONPATH=schedulingLogic python3 -m unittest
  schedulingLogic.tests.test_input_builder -v`: passes (2 tests).
- The broader scheduler suite could not run locally without `psycopg` and
  `python-sat`; the existing GitHub Actions job installs those dependencies.
- Parser tests could not run locally because Java is not installed in this
  workspace. An initial CI run confirmed that the legacy suite is not
  self-contained: it requires configured database credentials and specific
  catalog rows, while two manual tests use intentionally blank local PDF/output
  paths. The CI job therefore compiles the parser and test sources without
  claiming those environment-dependent tests pass.
- A true parser-to-live-solver smoke test requires deployed service access and a
  sanitized, representative audit fixture. It was not attempted here.

## Manual checks before beta

1. Use a synthetic audit for each supported major and compare every parsed
   completed and still-needed requirement with the fixture's expected result.
2. Confirm parser errors do not echo audit text or student identifiers.
3. Generate schedules with blocked times, requested courses, and credit bounds;
   verify the result independently against the input.
4. Remove and replace generated sections in the manual planner, reload, and
   export the edited schedule.
5. Confirm the review modal has no clickable requirement rows and that its saved
   scheduler payload preserves the parser's completed/still-needed partition.
6. Replace the parser's blank-path/manual tests and live catalog assumptions
   with synthetic fixtures and an isolated test database before treating the
   Java parser suite as an automated beta gate.
