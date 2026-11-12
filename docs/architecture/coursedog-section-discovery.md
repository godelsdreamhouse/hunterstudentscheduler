# Hunter Coursedog section discovery — Fall 2026 (`termId=1269`)

Status: read-only source analysis. No production database, scraper write path, scheduler, or application behavior was changed.

## Evidence and proposal boundaries

The counts and field observations below are point-in-time facts from the completed
Fall 2026 capture. Coursedog labels this `2026 Fall Term`, with dates from
2026-08-28 through 2026-12-21, while its separate academic-year field is `2027`.
The calendar term in this report follows the display name and dates. These facts
do not establish that Coursedog's public response contract
or Hunter's section patterns are stable across terms. The representation,
reconciliation, and test sections are proposals for later review, not implemented
behavior.

The raw JSONL and generated inventory are intentionally not committed: the raw
capture is about 23 MB and includes a large amount of source metadata. The
standalone script in `scripts/discover-coursedog-section-fields.py` can reproduce
the capture. Any future retained raw payload needs an explicit access, retention,
and redaction policy even though this investigation used a public endpoint.
The documented `logs/section-discovery-<term>/` output convention is narrowly
gitignored. Keep captures only for the active analysis and restrict local access.
When the analysis is complete, delete the entire output directory, including the
raw JSONL, inventory, error history, and quarantine tail. Inventory samples and
paths can contain public instructor names and source identifiers.

## Capture integrity

- Active undergraduate catalog courses requested: 9,472
- Complete course/term responses captured: 9,472
- Responses containing sections: 1,535
- Sections returned: 4,514
- Source request failures: 0
- Local raw response capture used for this analysis: `logs/section-discovery-1269/raw-section-responses.jsonl` (not committed)
- Local field/type/sample inventory: `logs/section-discovery-1269/field-inventory.json` (not committed)
- Public top-level section fields observed: 99, plus nested fields in meetings, instructors, restrictions, reserve capacity, course materials, class-association records, and related professor/room records

## Spring 2027 targeted linkage verification (`termId=1272`)

A read-only query on 2026-11-12 inspected Hunter's public Spring 2027 Coursedog
response for ANTHP 10100 (`courseGroupId=0219721`) at
`/api/v1/ca/htr01/sections/1272/0219721?includeRelatedData=true`. This was a
targeted verification, not a full Spring 2027 capture, so the aggregate counts
elsewhere in this report still describe Fall 2026 only. A minimized, timestamped
normalization of the public source fields used for this conclusion is preserved
at `docs/architecture/evidence/spring-2027-anthp-101-linkage.json`; instructor
names and unrelated metadata are omitted.

The response contained 15 sections. Associated class `1` contained one Lecture,
class `4162`, marked `Non-Enrollment Section`, and eight Laboratory choices,
including class `4165`, marked `Enrollment Section`. The association declaration
on class `4165` requires both `LAB` and `LEC`, with `OPTIONAL_SECTION=N` for each.
Therefore class `4165` is not a complete standalone enrollment result: its valid
combination includes the associated non-enrollment lecture, class `4162`. The
same association group offers seven other laboratory alternatives with that
lecture.

The deployed catalog currently returns both class `4162` and class `4165` as
`section_component=lecture` and does not expose their registration modes,
association, or required-component declaration. In a separate demonstrably
synthetic deployed scheduler replay, one returned alternative contained class
`4165` alone. That result omits the required lecture and is not an academically
valid complete combination according to the source association data. The exact
request, minimized response, deployment identity, timestamps, and replay commands
are preserved under `docs/architecture/evidence/`; catalog data is mutable, so a
later replay can legitimately return different alternatives.

This directly confirms the linked-component production risk for the target
Spring 2027 catalog. It does not authorize a scraper, schema, or solver change;
the proposed representation and fail-closed integration boundary below still
require owner approval and independent implementation review.

The discovery client deliberately omitted Coursedog's `returnFields` parameter and requested `includeRelatedData=true`, so the capture retained the complete public response rather than the production scraper's current projection.

## Verified linkage findings

`associatedClass` is the primary compatibility grouping key, but it must be scoped by course, term, and session. It is not a direct foreign key from a child to one lecture and it does not imply a one-to-one pairing.

- 3,754 `(course, sessionCode, associatedClass)` groups were observed.
- 75 groups contained more than one lab, discussion, recitation, clinical, or tutorial choice.
- Examples included one lecture with 11 labs, one lecture with 19 recitations, and one lecture with 11 discussions.
- In the usual multi-component pattern, the lecture is a `Non-Enrollment Section` and each selectable lab/discussion/recitation is an `Enrollment Section`. A student enrolls through the selectable component and receives the grouped lecture.
- Explicit `autoEnrollSect1`/`autoEnrollSect2` values appeared on only 66 of 4,514 sections. They are useful directed evidence when present, but cannot be the sole linkage mechanism.
- Public `linkedSections` and `relationships` arrays were empty throughout this term's section population.

The nested `_classAssociation.CLASS_COMPONENT` value declares the required
component set for the association, but its source shape is polymorphic:

- one object on 3,506 sections;
- an array on 951 sections; and
- absent on 57 sections.

Normalize an object to a single-element list and preserve an array as a list.
Absence is not evidence of a standalone component. Any future linkage pipeline
must quarantine a section when the declaration, session code, associated class,
or other required grouping input is absent or malformed rather than guessing.
Every observed component declaration used `OPTIONAL_SECTION=N`; the model should
still preserve the source value rather than hard-code that observation.

Observed component-set declarations included:

- lecture
- discussion + lecture
- lecture + recitation
- laboratory + lecture
- laboratory + lecture + recitation
- clinical + laboratory + lecture
- laboratory + recitation
- clinical + lecture
- standalone laboratory, clinical, field studies, independent study, internship, message, practicum, research, seminar, thesis research, and tutorial

Therefore the implementation must not special-case only lab/discussion/recitation. Source component codes observed were `CLN`, `DIS`, `FLD`, `IND`, `INT`, `LAB`, `LEC`, `MSG`, `PRA`, `REC`, `RSC`, `SEM`, `THE`, and `TUT`.

## Field semantics relevant to registration

- `sectionType`: the actual displayed section/component type (for example Lecture, Laboratory, Discussion, Recitation, Clinical).
- `registrationMode`: whether that record is an `Enrollment Section` (the section a student actively selects) or `Non-Enrollment Section` (typically added through the association/auto-enrollment relationship).
- `associatedClass`: the SIS class-association identifier grouping compatible component choices for the course/session.
- `sessionCode`: the SIS session within the term; it must participate in the grouping key.
- `_classAssociation.CLASS_COMPONENT[]`: all components required by the association, including component code, optional flag, contact hours, final-exam flag, auto-create flag, and workload hours.
- `autoEnrollSect1` / `autoEnrollSect2`: explicit section-number targets automatically added when the source provides them.
- `primInstrSect`: primary instruction section identifier; preserve as source metadata, but do not substitute it for association grouping.
- `registrationMode` is the practical enrollment role. The source does not expose a separate field literally named `enrollmentRole` in the captured section records.

The actual source paths matter. `sectionType` identifies the record's displayed
component. `customFields._classAssociation.SSR_COMPONENT._text` identifies an
association-declared component and can differ from both `sectionType` and the
components whose records are marked `Enrollment Section`. For example, a
non-enrollment Lecture record in a lecture/discussion group can
carry association component `DIS`. Do not use that association field as the
section's own component type. `autoEnrollSect1`, `autoEnrollSect2`, and
`primInstrSect` are under `customFields`, not at the section root.

## Other section information available

The complete response includes substantially more than the current production insert path stores:

- identity and lifecycle: source IDs, SIS/class number, course/offer number, term/year/semester/session, start/end dates, part of term, version, created/edited/synced metadata, status, schedule-print flags
- instruction and component structure: section type, registration mode, association, required components, auto-enroll targets, instruction mode/delivery mode, methods, contact/lecture/lab/other/workload hours
- enrollment: current/max/min/projected/prior enrollment, waitlist/max/projected waitlist, reserve-capacity rules, status (`Active`, `Cancelled Section`, `Stop Further Enrollment`, `Tentative Section`)
- academics: min/max/financial-aid/academic-progress/billing credits or hours, grading mode/options, requirement designation/group, consent and drop consent
- meetings: all meeting days/times/date ranges, rooms, topics, exam meetings, preferred times/rooms/features, room capacities
- people: all professor IDs and metadata including role, assignment type, time indexes, print flag, workload/contact/load factor; related professor names
- restrictions and relationships: registration restrictions, other restrictions, rule exceptions, cross-enrollment, conflicts, linked/relationship arrays
- student-facing content: section name/topic/notes, structured notes, course materials/textbook data, attributes
- full `customFields`, including the original SIS class-association artifact

## Recommended representation (proposal only)

Subject to an approved access and retention policy, keep a lossless raw source
payload for forward compatibility while normalizing fields that
correctness-critical queries and constraints need. A proposed additive model is:

1. `sections` retains the canonical section row and gains/uses normalized source fields:
   - stable source section ID and SIS class number
   - term/session/part-of-term
   - source status
   - source component code and display type
   - registration mode
   - associated class
   - credits/hours, enrollment/waitlist, consent, dates, notes, modality
   - `source_payload JSONB` and source revision timestamps/checksum
2. `section_component_requirements` records each association's declared component code and optional/auto-create flags, keyed by course + term + session + associated class.
3. `section_auto_enroll_links` records explicit directed section-number links when present.
4. Existing meetings remain one-to-many. The current scraper joins all resolved
   professor names in source order, but still loses per-instructor assignment
   metadata; a future lossless model should retain those assignments one-to-many.
5. A scrape-run/staging manifest tracks which source records were seen, enabling atomic reconciliation after a complete successful run.

The planner/scheduler should construct valid combinations by association group and required component set:

- identify compatible sections with the same course, term, session, and associated class;
- require exactly one compatible choice for each required non-optional component type, unless the source's enrollment role/explicit auto-enroll evidence makes a component implicit;
- allow multiple alternatives of the same type and enumerate combinations rather than attaching every child;
- preserve explicit auto-enroll links as stronger evidence when present;
- fail closed and flag the group when required component declarations cannot be resolved.

This proposal requires owner review before any production schema or scheduler change.

### Executable contract prototype

`scripts/section_linkage_model.py` is a non-production executable model of the
proposed normalization boundary. It has no database or scheduler imports and is
not called by the production scraper. It preserves the full source section,
separates the actual section component from the association component, groups
only by the composite association key, resolves explicit auto-enroll evidence,
enumerates component alternatives, and fails closed on missing or contradictory
evidence.

The prototype applies the explicit `source-status-active-only-v1` availability
policy. Only records whose source status is exactly `Active` can participate in
a combination. Cancelled, tentative, stop-enrollment, missing, or unknown
statuses quarantine the recoverable association rather than producing an
actionable result. This conservative research policy is not a production
availability decision.

Normalization returns valid groups and explicit quarantine diagnostics
separately. A malformed section quarantines every recoverable plausible
association group without suppressing unrelated valid groups from the same
course response. Contradictory custom and declared association IDs therefore
quarantine both candidate groups rather than trusting either value.
Every raw record participates in source-ID and course/term/session section-number
uniqueness checks before rejection, so malformed evidence cannot make an
otherwise ambiguous identifier appear safe. Quarantine records preserve the
complete raw source payload under the same restricted access and retention
policy as accepted source payloads; diagnostics never discard rejected evidence.
When both `id` and `_id` aliases are present they must agree, and every distinct
alias participates in collision checks. The enclosing course response supplies
the conservative course identity for collision checks when a malformed section
record omits its own `courseId`.
When a rejected record has a section number but no usable session code, every
candidate group with that term and section number is conservatively quarantined;
the model does not assume which session the malformed record belonged to.
`primInstrSect`, when present, must resolve to a section in the same composite
association; unresolved or cross-group targets quarantine that group. A group
is also quarantined when its explicit links cannot coexist with the
one-alternative-per-component rule, rather than being represented as an
unexplained empty combination set.

The executable contract additionally requires every member of an association
group to agree on the association component. Explicit auto-enroll links
must resolve to a different component in the same group; self-links and links
between alternatives of the same component are contradictions. A viable group
and every emitted combination must contain at least one `Enrollment Section`,
so the model never presents a collection containing only implicit
`Non-Enrollment Section` records as registrable.

Each emitted `EnrollmentCombination` has a deterministic content-derived ID,
the composite association key, component declarations, complete selected raw
source payloads, source section IDs, and explicit auto-enroll links. Members are
labeled `enrollment-entry` or `implicit-member` from the source registration
mode. IDs depend only on the association identity and selected source IDs, not
input order.

`scripts/test_section_linkage_model.py` supplies synthetic standalone,
multi-discussion, hypothetical multi-lab/recitation, clinical, association-scoping,
all-observed-component, optional-component, enrollment-role, auto-enroll,
polymorphic-declaration, and malformed-input cases. It is an
executable contract for the later Rust/SQL implementation, not authorization to
change production tables or scheduling logic.

The three-component Cartesian fixture is deliberately synthetic. The retained
Hunter capture did not contain an association with alternatives in two or more
component types, so this fixture tests a proposed representation property and
must not be cited as observed Hunter registration behavior.

## Reconciliation and cancelled sections

The term returned 302 `Cancelled Section`, 60 `Tentative Section`, 14 `Stop Further Enrollment`, and 4,138 `Active` records. The current scraper upserts returned records but does not reconcile records absent from a new successful scrape, and its insert path currently does not persist source status.

Safe deletion should happen only after a complete successful term scrape into staging:

1. capture the full term and verify no request failures;
2. validate identifiers, association completeness, and expected-volume guardrails;
3. upsert active/tentative/stop-enrollment source records according to approved display policy;
4. mark/delete explicitly cancelled records;
5. delete stale records not seen in the completed run;
6. commit reconciliation atomically and retain aggregate run diagnostics.

Never delete incrementally while source requests are still running; a partial source/API failure must not look like cancellation.

## Synthetic tests required before integration

- standalone lecture
- one non-enrollment lecture with multiple selectable discussions
- one lecture with multiple labs
- lecture + recitation with explicit auto-enroll target
- synthetic lecture + lab + recitation Cartesian choices with association
  scoping (representation hypothesis, not an observed Hunter fact)
- lecture + lab + clinical
- same `associatedClass` reused by different courses and sessions
- missing/unknown component code and unresolved required component
- explicit auto-enroll target missing from the payload
- `CLASS_COMPONENT` represented as one object
- `CLASS_COMPONENT` represented as an array
- missing component declaration, session code, or associated class
- malformed or error-enveloped HTTP 200 response
- truncated final JSONL record and an invalid middle record during resume
- duplicate course IDs, changing list totals, and truncated pagination
- delta-seconds and HTTP-date `Retry-After` values
- cancelled, tentative, stop-enrollment, and stale-absent reconciliation
- multiple instructors and multiple meeting records
- retry/resume idempotency and a partial-run failure proving no deletion
- lossless round-trip assertion that every public source field remains in `source_payload`

## Immediate conclusion

The scraper should be redesigned around the full source response. For linkage, use the composite association key plus the declared required component list, registration mode, and explicit auto-enroll targets when available. Do not infer linkage from section-number naming conventions and do not model a lecture as having only one child component.
