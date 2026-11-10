# Spring 2027 catalog correctness review

Reviewed 2026-11-06. All checks were read-only against public Hunter/Coursedog
sources and a temporary local PostgreSQL database. No production scrape ran and
no production data was changed.

## Method

The sample intentionally spans five high-use subject areas and different
section shapes:

| Course | Published Hunter catalog | Spring 2027 sections | Active | Cancelled | Tentative | Multi-instructor | TBA time |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| CSCI 12700 | [Introduction to Computer Science](https://hunter-undergraduate.catalog.cuny.edu/courses/0244931) | 8 | 8 | 0 | 0 | 4 | 4 |
| MATH 15500 | [Calculus 2](https://hunter-undergraduate.catalog.cuny.edu/courses/0299001) | 10 | 7 | 2 | 1 | 0 | 0 |
| ENGL 22000 | [Introduction to Writing about Literature](https://hunter-undergraduate.catalog.cuny.edu/courses/0260121) | 110 | 106 | 4 | 0 | 3 | 0 |
| POLSC 11000 | [American Government: A Historical Introduction](https://hunter-undergraduate.catalog.cuny.edu/courses/0320091) | 30 | 28 | 2 | 0 | 10 | 9 |
| ACCP 37100 | [Intermediate Accounting I](https://hunter-undergraduate.catalog.cuny.edu/courses/1209731) | 2 | 2 | 0 | 0 | 0 | 0 |

For each course, course identity, title, and credits were checked against the
published Hunter course page. Section numbers, class numbers, meeting days and
times, rooms, instructors, counts, status, and source sync time were checked in
the public Coursedog Spring 2027 (`1272`) section response:

`https://app.coursedog.com/api/v1/ca/htr01/sections/1272/{courseGroupId}`

The bounded sample contains 160 section records: 151 active, 8 cancelled, and
1 tentative. Course identity/title/credits matched the published pages for all
five courses. Sampled source records reported `lastSyncedAt` values between
2026-11-06 08:02:36.204Z and 08:02:36.296Z.

The public Satisfi backend documented in the repository returned HTTP 404 for
both `/api/catalog/terms` and the Spring 2027 section query during the review.
Therefore, production database contents could not be compared without changing
or deploying production, which was outside this task.

## Reproduced defects and changes

1. **Cancelled sections were schedulable.** Coursedog returns cancelled records
   in the same response as active ones. The scraper did not request `status`, so
   examples such as MATH 15500 section 01 and POLSC 11000 section 03 would be
   inserted. The scraper now requests status and deletes a previously imported
   copy when the source explicitly says `Cancelled Section`.
2. **TBA records became invented all-day meetings.** Thirteen sampled sections
   had a time record with no days and/or null start/end values. The importer
   substituted midnight and the maximum database time. It now omits incomplete
   TBA meeting rows while keeping the section itself.
3. **Only the first instructor was retained.** Seventeen sampled sections had
   multiple instructor IDs. The importer now resolves and stores every named
   instructor in source order; missing professor records no longer create the
   literal string `NULL`.
4. **Waitlist counts were always defaults.** The scraper did not request or
   persist `maxWaitlist` and `waitlist`. It now upserts both direct source
   values. No inferred open/closed/waitlist status was added.

## Verification

- `cargo fmt -- --check`: passed.
- `cargo test api::handlers::course_section::tests --lib`: 4 test functions
  passed against an isolated PostgreSQL 18 database. The cancellation test
  covers both exact cancellation removal and preservation of a reassigned class
  number's active owner.
- `npm test` in `backend/`: 4 passed.
- Public source sample: 5 courses / 160 Spring 2027 section records inspected.

## Risks and manual checks before beta

- **Review required:** the cancellation handler deletes matching rows in the
  scrape database. Run this PR only against a staging copy first, and verify
  the two cited cancelled examples disappear while active and tentative records
  remain. Do not merge or run it against production without approval.
- The source's `Active`/`Tentative Section` status is not the same as seat
  availability. `sections.enrollment_status` remains unset rather than guessing
  from capacity and waitlist counts. Product/registrar guidance is needed for
  what the UI should promise.
- The scraper still does not model Coursedog `sectionType`, associations, or
  linked lecture/recitation groups. The schema therefore defaults every record
  to a standalone lecture. CSCI 12700 demonstrates why this can affect schedule
  correctness; this needs a separately reviewed academic/solver contract change.
- A section removed entirely from an upstream response can remain stale locally;
  this PR removes explicit cancellations only. Safe term/course reconciliation
  needs a staging-tested deletion design.
- Section-level source timestamps are not stored. The existing
  `courses.last_updated` value is a local course-metadata scrape date and cannot
  prove that section imports completed. Add a dedicated section/source freshness
  field in a reviewed schema migration if operational guarantees are needed.
- After approval, run one controlled Spring 2027 staging scrape and compare at
  least the same five courses through `/api/catalog/sections`, including all
  meeting rows, instructor strings, cancellation absence, and waitlist values.
- Restore/deploy the public catalog route, then confirm `/api/catalog/terms`
  exposes Spring 2027. Production was not deployed or queried through private
  database access in this review.

## Deployed follow-up

Read-only checks after the approved catalog and deployment PRs landed confirmed
that the public backend is now healthy and `/api/catalog/terms` exposes Spring
2027 and Fall 2026. A deployed Spring 2027 CSCI query returned real class
numbers, instructors, enrollment counts, meeting days/times, and locations.

The follow-up also reproduced the reported attribute defect for `PHILO 23000`:
the deployed API currently returns only `WRIC - WRIC (Writing Intensive)`.
Coursedog's public record for course group `0316711` contains these top-level
attributes:

- `COPT - COPT (College Option)`
- `PLDI - GROUPC (Group C)`
- `WRIC - WRIC (Writing Intensive)`

The published-attribute enrichment added in the catalog-correctness change has
not yet been applied to production data because no production catalog sync ran
after that merge. The follow-up filter intentionally drops only `COPT`; it keeps
PLDI and WRIC. After review and merge, run one controlled Spring 2027 sync and
verify those two retained values through `/api/catalog/sections` and
`/api/catalog/attributes`. This follow-up did not run a scrape or modify
production data.
