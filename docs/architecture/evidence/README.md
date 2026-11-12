# Spring 2027 linkage evidence replay

These files preserve a privacy-safe, point-in-time comparison between Hunter's
public Coursedog association data and the deployed catalog/scheduler projection.
The scheduler request is constructed, uses EMPLID `0`, and has no completed-course
history. Do not substitute production student data.

`spring-2027-anthp-101-replay-2026-11-12.json` is a second read-only replay. It
records SHA-256 hashes and byte counts for both exact response bodies plus the
privacy-minimized source path/value extracts used for the comparison. The full
responses are intentionally not committed because they contain unrelated public
instructor and source metadata. The hashes authenticate a retained exact body if
one is supplied later; the committed extracts make the academic linkage claim
reviewable without relying only on the prose summary.

Select the public beta explicitly, then inspect the current catalog projection:

```bash
BETA_BASE_URL=https://d263b17wgkx1dd.cloudfront.net
curl -sS "$BETA_BASE_URL/api/catalog/sections?term_season=SPRING&term_year=2027&q=ANTHP%2010100&limit=50&offset=0"
```

Replay the preserved three-credit request:

```bash
curl -sS -H 'Content-Type: application/json' \
  --data-binary @docs/architecture/evidence/spring-2027-anthp-101-scheduler-request.json \
  "$BETA_BASE_URL/api/schedule/generate"
```

Create and replay the one-field four-credit control used for the historical
successful response:

```bash
jq '.parser_payload.requirements_needed[0].credits_needed = 4' \
  docs/architecture/evidence/spring-2027-anthp-101-scheduler-request.json \
  > /tmp/satisfi-anthp-101-four-credit.json
curl -sS -H 'Content-Type: application/json' \
  --data-binary @/tmp/satisfi-anthp-101-four-credit.json \
  "$BETA_BASE_URL/api/schedule/generate"
```

Compare new output with the timestamped normalized observation rather than
overwriting it. The catalog is mutable, and this replay does not itself verify
linked-component completeness; use the separate Coursedog association artifact
for that check.
