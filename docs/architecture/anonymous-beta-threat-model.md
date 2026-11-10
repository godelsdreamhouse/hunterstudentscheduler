# Anonymous student-beta threat model

**Reviewed baseline:** `0f01e02edae47747a86436f6f41816f2233eb9f9`

**Scope:** DegreeWorks upload, browser storage, parser and scheduler calls,
production request boundaries, and anonymous-abuse controls for the three-major
student beta. This review does not authorize an authentication redesign,
production infrastructure changes, or scheduler changes.

## Verified data flow

```text
student browser
  -> POST original PDF to Java /AuditParse
  <- normalized audit facts
  -> store audit facts in tab sessionStorage
  -> store planner preferences, times, and schedules in localStorage
  -> POST normalized facts and preferences to Python /api/schedule/generate
  <- generated schedules
```

- `src/app/pages/UploadAudit.tsx` sends the original PDF as multipart data. The
  browser does not save the original PDF or filename.
- `parser/src/main/java/edu/hunter/watchtower/PDFParser/PDFController.java`
  validates the filename suffix and PDF signature, parses a randomly named
  temporary file, and attempts deletion in `finally`.
- Parser success and upload-limit responses use `Cache-Control: no-store`.
  Spring disables request-detail logging and detailed error responses.
- `src/app/hooks/useAuditData.ts` keeps normalized GPA, credits, majors,
  completed courses, and remaining requirements in `sessionStorage`.
- Planner preferences, unavailable times, chosen courses, and selected or
  generated schedules remain in `localStorage` until Clear planning data is
  used. The clear flow removes current and legacy planning keys while preserving
  unrelated browser data.
- `src/app/pages/ViewSchedules.tsx` sends normalized academic data and a random
  browser-local planning identifier directly to the scheduler. The identifier
  is not a Hunter EMPLID despite the legacy payload field name.
- Scheduler catalog access is parameterized and read-only. The deployed compute
  database role has `SELECT` only. Temporary WCNF files are removed in `finally`.
- Production account routes and database sessions are disabled. No server-side
  student audit record or cross-student retrieval path was found in this flow.
- API access logs omit request bodies and headers and expire after 14 days.

## P0 risks before real audit uploads

### 1. The advertised upload can exceed Lambda's ingress envelope

Baseline UI and Spring limits allow a 5 MiB PDF and a 6 MB multipart request.
Production uses API Gateway payload format 2.0 with a synchronous Lambda
integration. Base64 expands a 5 MiB binary body to about 6.67 MiB before the
proxy-event wrapper, likely exceeding Lambda's 6 MB synchronous request limit
even though HTTP API Gateway accepts 10 MB.

Existing parser integration tests stop at embedded Tomcat and therefore cannot
prove the deployed API Gateway-to-Lambda boundary. Candidate `c6fc027` lowers
the aligned UI/parser file limit to 4 MiB and the full multipart request to
4,400 KiB, with exact and oversized local boundary tests. It still requires an
accepted/rejected near-boundary test through the deployed route.

Authoritative limits:

- [API Gateway HTTP API quotas](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-quotas.html)
- [AWS Lambda quotas](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html)

### 2. Anonymous expensive routes can be monopolized

The parser and scheduler routes have no authorizer. The raw execute-api endpoint
is enabled, and both 1,536 MB Lambda functions share one stage-wide throttle of
5 requests per second with a burst of 10. A scheduler invocation may run for 18
seconds. One script can therefore consume concurrency, database connections,
the shared throttle, and budget while legitimate students receive throttles or
timeouts.

The existing global throttle and Lambda timeouts bound individual work but do
not prevent sustained monopolization. The smallest anonymous-beta mitigation is
to add reviewed per-route throttles, reserved concurrency, and privacy-safe
cost/concurrency/throttle alarms; exercise malformed and compressed PDFs; and
record acceptance of the remaining denial-of-service risk. These are production
infrastructure decisions and require owner approval.

### 3. Students need disclosure before transmission

The baseline upload screen does not explain that the full audit leaves the
browser, is briefly written to Lambda temporary storage, and produces normalized
data retained in browser storage. Explaining storage only in a later clear-data
dialog is too late for informed upload.

Candidate `dd13449` adds a pre-upload explanation of temporary parsing,
tab-local audit facts, longer-lived local planner data, shared-computer clearing,
and the prohibition on uploading another student's audit. It also adds a
persistent planning-aid beta notice. The expanded copy requires independent PR
review and deployed desktop/mobile verification.

## Existing controls and remaining notes

- Parser responses avoid filenames, audit contents, and stack details. Tests
  cover temporary deletion, generic malformed-PDF responses, private 413
  responses, CORS rejection, and non-echoed filenames.
- Candidate `c6fc027` adds observable metadata-only cleanup failures, truncation
  before a failed-unlink retry, active-file race protection, and next-request
  cleanup for stale `audit-*.pdf` files. This is best-effort cleanup, not an
  absolute five-minute retention guarantee.
- Scheduler CORS accepts any `*.cloudfront.net` origin. CORS is not
  authentication, but exact-origin configuration would reduce browser-mediated
  abuse.
- Scheduler timeout diagnostics include exact specifically requested courses.
  Prefer aggregate operational fields when exact course lists are unnecessary.
- Scheduler responses do not explicitly set `Cache-Control: no-store`; the
  production CloudFront API policy has zero caching and requests are POST, but
  the response header would be useful defense in depth.
- Shared computers remain a privacy risk until the student clears planning data.
  Closing the tab clears normalized audit facts but does not clear local planner
  preferences or schedules.

## Required release evidence

1. Two independent reviewers approve the upload-limit, cleanup, and disclosure
   candidates; protected infrastructure changes receive owner approval.
2. Deployed tests prove one accepted and one rejected PDF near the configured
   boundary through API Gateway and Lambda without personal data.
3. Malformed, compressed, and oversized synthetic PDFs produce bounded work,
   generic errors, `no-store`, and no payload logging.
4. Load tests confirm per-route throttles and reserved concurrency preserve a
   usable manual catalog path while parser or scheduler traffic is saturated.
5. Desktop and mobile tests verify the disclosure appears before file selection,
   Clear planning data removes both storage classes, and tab close removes
   normalized audit facts.
6. The beta owner records the anonymous-access decision, alert owner, budget
   threshold, incident contact, and rollback procedure before invitations.
