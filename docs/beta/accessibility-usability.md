# Usability and Accessibility Beta Review

## Improvements in this review

- Added a page heading and explicit tab, tab-panel, and view relationships for
  Course Search and Schedule.
- Added a programmatic label and search input type to the catalog search.
- Connected the Filters button to its filter region and exposed the selected
  state of open-seat and day filters with `aria-pressed`.
- Exposed expanded course details through `aria-expanded` and `aria-controls`.
- Announced loading, catalog fallback, imports, conflicts, and export errors with
  status or alert semantics.
- Marked the weekly calendar as a named region.
- Replaced the nested label/button conflict toggle with a correctly named switch.
- Removed the inactive About control, which redirected back to the same planner
  after the landing page was retired.

No scheduling, catalog, academic, persistence, or export rules changed.

## Verification performed

- Production frontend build passed.
- `git diff --check` passed.
- Local visual checks passed at 1440 × 1000 and 390 × 844. The narrow layout
  presents Course Search and Schedule as separate tabs, keeps the search and
  filter controls visible, truncates long course titles, and avoids horizontal
  page overflow.

## Remaining manual checks

Before beta, test the deployed application with current Chrome, Safari, and
Firefox, including:

1. Keyboard-only traversal and visible focus through search, filters, course
   details, section actions, saved schedules, and the Smart Builder.
2. VoiceOver or NVDA announcements for tab changes, loading, conflicts, empty
   results, and expanded section details.
3. Browser zoom at 200% and phone widths down to 320 px.
4. Upload/review modal focus containment and focus restoration after close.
5. Calendar meaning without color and with forced-colors/high-contrast mode.
6. Download and error behavior when popups or downloads are restricted.

The audit-review modal's clickable requirement rows remain a known keyboard and
academic-workflow concern. That control was not changed here because its ability
to alter parsed completion status requires the separate academic/product
decision documented in the DegreeWorks workflow review.
