# Hunter major-program data exploration

Reviewed 2026-11-06. This was a read-only investigation of Hunter's public
catalog and Coursedog data. It did not access DegreeWorks, student records,
production credentials, or production database data.

## Outcome

Hunter's published major requirements are available as structured Coursedog
JSON. Satisfi can ingest those structures instead of parsing rendered program
pages. They are suitable for building a catalog-versioned requirement model,
but they are not sufficient to replace a student's DegreeWorks audit by
themselves.

The stable-looking school identifier is `htr01`. The investigation observed the
2026–2027 Undergraduate Catalog ID `TKrb16WqUYMgUVoEqK2D`, but ingestion must
discover the current catalog dynamically rather than hard-code that value.

## Public endpoint shapes

- Program inventory:
  `POST https://app.coursedog.com/api/v1/cm/htr01/programs/search/%24filters`
- Program revisions:
  `GET https://app.coursedog.com/api/v1/cm/htr01/programs?programGroupIds={plan}&catalogId={catalog}`
- Referenced courses:
  `GET https://app.coursedog.com/api/v1/cm/htr01/courses?courseGroupIds={ids}&catalogId={catalog}`
- Referenced course sets:
  `GET https://app.coursedog.com/api/v1/cm/htr01/courseSets/{id}?catalogId={catalog}`

The public catalog client sends `Origin:
https://hunter-undergraduate.catalog.cuny.edu` and the non-secret
`X-Requested-With: coursedog-core` header. These endpoints are public but
undocumented; consumers should use low request rates, caching, retries with
backoff, catalog snapshots, and source-change monitoring.

An unfiltered inventory returned 705 mixed undergraduate/graduate and
active/inactive revisions. A correct importer must reproduce the published
catalog filters and effective-date rules before treating a revision as current.

## Sociology BA probe

The [Sociology BA requirements page](https://hunter-undergraduate.catalog.cuny.edu/programs/SOC-BA/requirements-GLSsG)
corresponds to a structured `SOC-BA` rule tree. Observed node types include:

- `allOf`
- `completedAllOf`
- `completedAtLeastXOf`
- `minimumCredits`
- `minimumGrade`
- direct course references
- reusable course-set references
- `freeformText`

Course references resolve to catalog course codes; for example, course group
`0337961` resolves to `SOC 10100`. Course sets can combine explicit members
with designation, status, or career filters. Program records also include
effective dates, revision identifiers, department ownership, and degree-map
data.

Freeform rules cannot safely become executable eligibility or audit logic
without academic review. The normalized model must retain their source text and
flag them for human interpretation rather than guessing.

## School of Arts and Sciences scope

Use Hunter's official [Majors & Degree Tracks](https://www.hunter.cuny.edu/academics/majors-degree-tracks/)
table as the authoritative SAS whitelist, cross-checked against
[Departments and Programs](https://www.hunter.cuny.edu/academics/departments-and-programs/).
Do not infer school membership from a BA/BS suffix: degree type alone does not
identify the owning school.

Relevant institution-wide sources include:

- [Requirements for Graduation](https://hunter-undergraduate.catalog.cuny.edu/academics/academic-requirements/general-requirements/requirements-for-graduation-hunter-core-and-major-field-of-study)
- [The Academic Program](https://hunter-undergraduate.catalog.cuny.edu/academics/academic-requirements/general-requirements/the-academic-program)
- [General Education Requirements](https://hunter-undergraduate.catalog.cuny.edu/academics/academic-requirements/general-requirements/general-education-effective-fall-2019)
- [New York State liberal-arts rule](https://hunter-undergraduate.catalog.cuny.edu/academics/academic-requirements/course-policies/new-york-state-rule-for-liberal-arts-and-sciences-courses)
- [School of Arts and Sciences overview](https://hunter-undergraduate.catalog.cuny.edu/schools/school-of-arts-and-sciences/overview)

## Recommended normalized model

Preserve source provenance and effective dating. A future reviewed schema would
need:

- catalog snapshots and ingest-run metadata;
- programs and effective-dated program revisions;
- parent/child requirement-rule nodes;
- typed selections for courses, course sets, designations, and generic choices;
- resolved course-set membership tied to a catalog snapshot;
- degree maps; and
- school/department classification with an authoritative source reference.

Store the original source payload or a content hash alongside normalized nodes
so upstream changes can be diffed and reviewed before they affect planning.

## Boundary with DegreeWorks

Catalog rules describe published programs, not an individual student's official
audit. They do not reliably encode:

- transfer equivalencies;
- catalog-year eligibility;
- substitutions and waivers;
- repeated-course and GPA treatment;
- residency and double-counting decisions; or
- student-specific exceptions.

For beta, published program data should explain requirements and broaden
planning support while DegreeWorks remains the personalized source. Satisfi must
continue to describe schedules as planning assistance rather than an official
degree audit.

## First implementation slice

Build a read-only probe for `SOC-BA` and two structurally different SAS majors.
For each catalog snapshot:

1. discover and select the published undergraduate revision;
2. normalize its rule tree without executing it;
3. resolve course and course-set references;
4. flag freeform or unsupported nodes;
5. compare the normalized output with the rendered Hunter requirement page; and
6. produce a human-reviewable diff when the source changes.

Do not add production schema or solver behavior until the three-program probe is
validated and the academic interpretation of each supported node type is
reviewed.
