# Spring 2027 credit-cap replay

These artifacts preserve the minimal scheduler request and normalized response
evidence used by the protected-scheduler report. The request is demonstrably
synthetic: it uses EMPLID `0`, has no completed-course history, and contains one
constructed remaining requirement. It performs no database writes.

The separate parser observation used the repository's `exampleAudit.txt`.
Although that file has placeholder direct identifiers, the provenance of its
academic-history details is undocumented. Do not call it wholly synthetic or
repeat a deployed upload until that provenance is resolved.

Replay the three-credit request against an explicitly selected environment:

```bash
curl -sS \
  -H 'Content-Type: application/json' \
  --data-binary @test-fixtures/deployed-beta/spring-2027-credit-cap-request.json \
  "$BETA_BASE_URL/api/schedule/generate"
```

Create the one-field four-credit control and replay it:

```bash
jq '.parser_payload.requirements_needed[0].credits_needed = 4' \
  test-fixtures/deployed-beta/spring-2027-credit-cap-request.json \
  > /tmp/satisfi-credit-cap-control-request.json
curl -sS \
  -H 'Content-Type: application/json' \
  --data-binary @/tmp/satisfi-credit-cap-control-request.json \
  "$BETA_BASE_URL/api/schedule/generate"
```

The catalog is mutable. Compare a replay with
`spring-2027-credit-cap-observation.json` and record new deployment identifiers
instead of overwriting historical results. Do not use production student data.

Run the deterministic local characterization independently of the catalog:

```bash
PYTHONPATH=schedulingLogic python3 -m unittest \
  schedulingLogic.tests.test_requirement_credit_cap -v
```
