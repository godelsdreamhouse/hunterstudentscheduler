# Student Journey Verification

This beta check covers the account-free manual planner without using production
credentials or changing production data.

## Automated coverage

The frontend test suite verifies:

- catalog searches send the selected Spring 2027 term, trimmed text, course
  attribute, and pagination values, and surface failed HTTP responses;
- a section can be added and removed;
- duplicate classes and alternate sections of an already selected course are
  rejected;
- overlapping meetings are rejected while back-to-back meetings are allowed;
- open-section, instruction-mode, meeting-day, and conflict filters compose as
  expected;
- schedules round-trip through browser-local storage and malformed saved data
  falls back safely;
- Spring 2027 calendar exports include recurring meetings and section details,
  while unsupported terms are rejected rather than receiving incorrect dates.

Run the checks with:

```bash
npm test
npm run build
```

The `Frontend tests` GitHub Actions workflow runs both commands on relevant pull
requests and pushes to `main`.

## Implementation notes

Planner rules were moved into `src/lib/plannerJourney.ts` so the UI and tests use
the same add, remove, conflict, status, and filter behavior. The extraction does
not change the user-visible rules: conflicting sections and two sections of one
course remain blocked, and schedules continue to save automatically in the
browser.

## Manual beta checks still required

Complete these checks against the deployed beta after its catalog and services
are confirmed healthy:

1. Search by course code, title, instructor, and a course attribute.
2. Combine open-only, modality, day, attribute, and hidden-conflict filters.
3. Add and remove sections from both the result list and calendar panel.
4. Confirm the conflict and duplicate-course messages are understandable.
5. Create, rename, switch, and delete multiple saved schedules; reload the page
   and confirm they persist in the same browser.
6. Import the downloaded `.ics` file into at least Google Calendar and Apple or
   Outlook Calendar and inspect recurrence, exclusions, location, and timezone.
7. Repeat the journey at phone and desktop widths with keyboard-only input.

These remain manual because this repository does not yet have a browser
end-to-end harness or isolated seeded catalog service. They must not be run with
real student audit data during beta verification.
