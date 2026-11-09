# Hunter Coursedog section discovery — Fall 2027 (`termId=1269`)

Status: read-only source analysis. No production database, scraper write path, scheduler, or application behavior was changed.

## Evidence and proposal boundaries

The counts and field observations below are point-in-time facts from the completed
Fall 2027 capture. They do not establish that Coursedog's public response contract
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
4. Existing meetings remain one-to-many; instructor assignments should also become one-to-many instead of retaining only the first professor.
5. A scrape-run/staging manifest tracks which source records were seen, enabling atomic reconciliation after a complete successful run.

The planner/scheduler should construct valid combinations by association group and required component set:

- identify compatible sections with the same course, term, session, and associated class;
- require exactly one compatible choice for each required non-optional component type, unless the source's enrollment role/explicit auto-enroll evidence makes a component implicit;
- allow multiple alternatives of the same type and enumerate combinations rather than attaching every child;
- preserve explicit auto-enroll links as stronger evidence when present;
- fail closed and flag the group when required component declarations cannot be resolved.

This proposal requires owner review before any production schema or scheduler change.

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
- lecture + lab + recitation Cartesian choices with association scoping
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
