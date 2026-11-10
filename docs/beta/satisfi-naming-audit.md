# Satisfi naming audit

## Outcome

The student-facing product can adopt the **Satisfi** name without renaming its
deployed AWS resources, database objects, Java packages, or browser storage keys
in the same release. Those internal identifiers carry compatibility and rollout
risk and should be migrated separately.

This audit is based on a case-insensitive search for `watchtower` across the
tracked application, service, database, scraper, scheduler, parser, and
architecture sources. Generated output and dependency directories were excluded.

## Remaining references

| Area | Examples | User-visible | Recommended treatment |
| --- | --- | --- | --- |
| Product documentation | Root and component README titles/descriptions, architecture diagram labels, scheduler technical document | Yes | Update copy to Satisfi in a documentation-only change. Retain a short "formerly Watchtower" note where it helps existing contributors. |
| Frontend package metadata | Root `package.json` and lockfile package name | Mostly no | Change only after checking build and deployment scripts for name assumptions. This is low operational risk but does not need to block the visible rename. |
| Parser metadata | Maven artifact/name, Spring application name, Docker JAR path | No | Keep stable initially. An artifact rename changes the Docker build contract and should be tested as a separate service change. |
| Java namespace | `edu.hunter.watchtower` source and test packages | No | Keep initially. A later mechanical rename must move every package path/import and pass the complete parser test suite. It provides no student-facing beta value. |
| Browser storage | Audit, preferences, setup progress, planning session, active user, and legacy planner keys prefixed with `watchtower` | No, but stateful | Do not directly rename or delete. If renamed, use copy-on-read migration with old-key compatibility for at least one release, then remove old keys in a later reviewed release. Audit data needs the privacy policy applied regardless of key name. |
| Local database environment | Compose container, volume, database, credentials, mount paths, and README commands | Developer-visible | Preserve by default. Renaming can orphan an existing local volume or make established commands fail. If desired later, provide an explicit migration and rollback path. |
| Deployed URLs and resource identifiers | Legacy Render/Vercel examples and existing AWS-backed service names | Sometimes | Remove or correct obsolete public URLs after endpoint verification. Keep active Lambda, ECR, S3, CloudFront, secret, and stack identifiers stable; marketing names do not require infrastructure replacement. |
| Internal source descriptions | Scraper CLI description and architecture model identifiers | Limited | Update human-readable descriptions; leave identifiers stable where changing them provides no user benefit. |

## Safe rollout plan

### Phase 1: student-facing identity

1. Confirm the final display name, capitalization, short description, and whether
   any screen should say "formerly Watchtower."
2. Replace visible application copy, document headings, page metadata, and
   accessibility names with Satisfi.
3. Update screenshots and help text after the UI copy lands.
4. Verify the planner, smart builder, upload flow, mobile layout, and exported
   schedule text for stale visible names.

This phase should not change API routes, database names, storage keys, deployed
resource names, or service contracts.

### Phase 2: low-risk developer metadata

Update package display metadata and human-readable component descriptions in
small component-specific changes. Validate the frontend build, container build,
and relevant component tests. Remove stale Render/Vercel documentation only
after confirming it is not an active fallback or operational reference.

### Phase 3: compatibility migrations only when justified

- Browser storage: introduce new Satisfi keys with copy-on-read migration and
  explicit cleanup timing. Preserve saved preferences and schedules throughout.
- Java namespace/artifact: perform a mechanical package and Docker contract
  migration in one parser-only change with full tests.
- Local PostgreSQL names: leave stable unless there is a strong developer need;
  any rename needs instructions that preserve or deliberately migrate the volume.
- AWS resources: retain the existing physical identifiers. If a future business
  requirement demands renaming them, treat it as an infrastructure migration
  with reviewed aliases/cutover, rollback, cost, and data-retention plans—not a
  repository-wide search-and-replace.

## Acceptance checks for the visible rename

- No student-facing screen, browser title, help text, or export says Watchtower.
- Existing saved preferences and schedules survive the release.
- Parser, scheduler, scraper, and catalog API contracts remain unchanged.
- Production endpoints and physical AWS resources are not recreated or renamed.
- Repository search results that remain are documented internal compatibility
  identifiers rather than accidental public branding.

## Decisions requiring product review

- Final Satisfi wordmark/capitalization and one-sentence product description.
- Whether and where to display "formerly Watchtower."
- Whether historical technical documents should be rewritten or preserved as an
  accurate record with a naming note.
- How long browser storage migration compatibility should be maintained.

