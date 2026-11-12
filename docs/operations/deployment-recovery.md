# Production deployment recovery

This runbook documents recovery for the AWS-hosted Satisfi application. It does
not authorize a deployment, rollback, secret change, database change, or
CloudFormation update. Production recovery requires the owner's explicit
approval and an authenticated AWS administrator.

## Deployment boundary

Every push to `main` runs verification and, after verification succeeds,
deploys automatically. A manual **Deploy application** run from `main` follows
the same path. Pull requests run verification only.

After verification, the production mutation sequence is not atomic:

1. the web and compute values in Secrets Manager are stored or replaced;
2. three commit-tagged container images are pushed to ECR;
3. the web, scheduler, and parser Lambda functions are updated;
4. the frontend is built, synchronized to the versioned S3 site bucket, and
   CloudFront is invalidated; and
5. the public site and service health routes are smoke-tested.

A failure or concurrency cancellation during or after step 1 can therefore
leave partially updated secret state or a mixed deployment. Existing Lambda
environment values are resolved by CloudFormation rather than fetched from
Secrets Manager on every invocation, but the stored secret state has still
changed. Do not assume a failed workflow left production unchanged.

## Triage without changing production

1. Stop merging until the newest `main` deployment has a terminal result.
2. Record the failing workflow URL, commit SHA, run ID, failed step, and UTC
   time. Do not restart it merely to hide a reproducible failure.
3. Pin and verify the production account and region, then read current stack
   outputs, secret metadata, and both requested and resolved Lambda image URIs.
   The metadata command does not retrieve secret values:

   ```bash
   export AWS_REGION=us-east-1
   export AWS_DEFAULT_REGION=us-east-1
   test "$(aws sts get-caller-identity \
     --query 'Account' --output text)" = '134604497934'

   aws cloudformation describe-stacks \
     --stack-name hunter-scheduler-app \
     --query 'Stacks[0].Outputs' \
     --output table

   for secret in web compute; do
     aws secretsmanager describe-secret \
       --secret-id "hunter-scheduler/$secret" \
       --query '{ARN:ARN,LastChangedDate:LastChangedDate,Versions:VersionIdsToStages}'
   done

   for service in web solver parser; do
     aws lambda get-function \
       --function-name "hunter-scheduler-$service" \
       --query 'Code.{Requested:ImageUri,Resolved:ResolvedImageUri}' \
       --output table
   done
   ```

   Requested image tags have the form `<git-sha>-<github-run-id>`, but tags can
   be mutable. Record `ResolvedImageUri`, which identifies the deployed bytes
   by digest. If the three requested references do not identify the same
   deployment, treat production as a mixed release. Do not infer exact image
   identity from a tag alone.
   The ECR repositories are created outside the committed infrastructure, so
   also inspect their deployed lifecycle policies before relying on an older
   image being available:

   ```bash
   for service in web solver parser; do
     aws ecr get-lifecycle-policy \
       --repository-name "hunter-scheduler-$service" \
       --query 'lifecyclePolicyText' \
       --output text
   done
   ```

   A missing policy or failed lookup is not evidence of a particular retention
   depth. Record the result and list candidate images before choosing one.
4. Run read-only public checks using stack outputs rather than a remembered URL:

   ```bash
   SATISFI_SITE_URL=$(aws cloudformation describe-stacks \
     --stack-name hunter-scheduler-app \
     --query "Stacks[0].Outputs[?OutputKey=='SiteUrl'].OutputValue" \
     --output text)
   SATISFI_API_URL=$(aws cloudformation describe-stacks \
     --stack-name hunter-scheduler-app \
     --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" \
     --output text)

   curl --fail --silent --show-error "$SATISFI_SITE_URL/" >/dev/null
   curl --fail --silent --show-error "$SATISFI_SITE_URL/api/health"
   curl --fail --silent --show-error "$SATISFI_SITE_URL/api/schedule/health"
   curl --fail --silent --show-error "$SATISFI_SITE_URL/parser/health"
   curl --silent --show-error --output /dev/null --write-out '%{http_code}\n' \
     "$SATISFI_API_URL/api/users/profile"
   ```

   The final command must print `404`. Use only synthetic data for any deeper
   parser or scheduler probe.

## Preferred recovery: reviewed revert

When GitHub Actions and AWS are operational, recovery is another reviewed
release:

1. Identify the last commit whose deployment and smoke-test jobs succeeded.
2. Prepare a revert PR for the faulty merge or a narrowly scoped corrective PR.
   Do not rewrite `main` and do not bypass the two-reviewer requirement.
3. Require normal CI and both independent reviewers on the exact recovery SHA.
4. Merge only with owner approval when the change touches protected scheduler
   logic, academic interpretation, schema, authentication, infrastructure, or
   production data.
5. Let the automatic `main` workflow rebuild all three images and the frontend.
6. Confirm the newest workflow, not a superseded run, completed every smoke test.
7. Repeat the read-only checks above and record both requested and resolved
   image URIs.

Do not use `bootstrap_images_only` as a rollback. It publishes images and
secrets but deliberately does not update the running functions or frontend.

## Emergency service rollback

Use this only when normal recovery cannot complete and the owner explicitly
approves direct production mutation.

1. From contemporaneous evidence for the last successful deployment, identify
   the exact ECR digest URI (`repository@sha256:...`) for each service. Useful
   evidence includes a recorded `Code.ResolvedImageUri`, or the digest in the
   successful image-push log. Resolving a tag only at recovery time is not
   contemporaneous evidence of the bytes that succeeded. If no trustworthy
   digest record exists, do not perform a direct image rollback. Never select
   an image merely because it is the newest remaining tag; availability depends
   on repository contents and externally managed lifecycle policies.
2. Update all three functions to their matching known-good images, then wait for
   and verify each resolved digest. Set the three digest URI variables from the
   evidence above before running this fail-fast block; do not replace them with
   guessed or newly resolved tags. The block pins and validates the production
   AWS account and region before mutation:

   ```bash
   set -euo pipefail

   readonly SATISFI_PROD_ACCOUNT_ID='134604497934'
   readonly AWS_REGION='us-east-1'
   export AWS_REGION
   export AWS_DEFAULT_REGION="$AWS_REGION"
   test "$(aws sts get-caller-identity \
     --query 'Account' --output text)" = "$SATISFI_PROD_ACCOUNT_ID"

   : "${SATISFI_WEB_IMAGE_DIGEST_URI:?set the recorded web digest URI}"
   : "${SATISFI_SOLVER_IMAGE_DIGEST_URI:?set the recorded solver digest URI}"
   : "${SATISFI_PARSER_IMAGE_DIGEST_URI:?set the recorded parser digest URI}"

   update_service() {
     local service="$1"
     local image_uri="$2"
     local function_name="hunter-scheduler-$service"
     local deployed_uri
     local registry="$SATISFI_PROD_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
     local expected_prefix="$registry/hunter-scheduler-$service@sha256:"

     case "$image_uri" in
       "$expected_prefix"*) ;;
       *) echo "Invalid production digest URI for $service" >&2; return 1 ;;
     esac

     aws lambda update-function-code \
       --function-name "$function_name" \
       --image-uri "$image_uri" >/dev/null
     aws lambda wait function-updated-v2 \
       --function-name "$function_name"
     deployed_uri=$(aws lambda get-function \
       --function-name "$function_name" \
       --query 'Code.ResolvedImageUri' \
       --output text)
     test "$deployed_uri" = "$image_uri"
   }

   update_service web "$SATISFI_WEB_IMAGE_DIGEST_URI"
   update_service solver "$SATISFI_SOLVER_IMAGE_DIGEST_URI"
   update_service parser "$SATISFI_PARSER_IMAGE_DIGEST_URI"
   ```

   This sequence is still not atomic. If any command fails, stop immediately,
   record the current URI of all three functions, and reassess the mixed state.

3. The workflow does not archive a deployable frontend artifact or a deployment
   manifest mapping S3 object versions to a commit. The bucket is versioned, but
   do not guess object versions. If the frontend must be restored immediately,
   build the exact known-good commit in an isolated, clean checkout using Node
   20, then use the same upload sequence as `deploy.yml`. Set
   `SATISFI_KNOWN_GOOD_SHA` to the full recorded commit SHA first. Record the
   commit, every command, and every affected bucket or distribution. Run this
   as one fail-fast block:

   ```bash
   set -euo pipefail

   readonly SATISFI_PROD_ACCOUNT_ID='134604497934'
   readonly AWS_REGION='us-east-1'
   export AWS_REGION
   export AWS_DEFAULT_REGION="$AWS_REGION"
   test "$(aws sts get-caller-identity \
     --query 'Account' --output text)" = "$SATISFI_PROD_ACCOUNT_ID"

   : "${SATISFI_KNOWN_GOOD_SHA:?set the full recorded commit SHA}"
   test "$(git rev-parse HEAD)" = "$SATISFI_KNOWN_GOOD_SHA"
   test -z "$(git status --porcelain)"
   case "$(node --version)" in
     v20.*) ;;
     *) echo 'Node 20 is required' >&2; exit 1 ;;
   esac

   npm ci
   npm run typecheck
   npm run build
   test -s dist/index.html
   test -d dist/assets

   SATISFI_BUCKET=$(aws cloudformation describe-stacks \
     --stack-name hunter-scheduler-app \
     --query "Stacks[0].Outputs[?OutputKey=='SiteBucketName'].OutputValue" \
     --output text)
   SATISFI_DISTRIBUTION=$(aws cloudformation describe-stacks \
     --stack-name hunter-scheduler-app \
     --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" \
     --output text)
   test -n "$SATISFI_BUCKET"
   test "$SATISFI_BUCKET" != 'None'
   test -n "$SATISFI_DISTRIBUTION"
   test "$SATISFI_DISTRIBUTION" != 'None'

   aws s3 sync dist "s3://$SATISFI_BUCKET" \
     --delete --cache-control 'public,max-age=300'
   aws s3 cp dist/assets "s3://$SATISFI_BUCKET/assets" \
     --recursive --cache-control 'public,max-age=31536000,immutable'
   SATISFI_INVALIDATION_ID=$(aws cloudfront create-invalidation \
     --distribution-id "$SATISFI_DISTRIBUTION" \
     --paths '/*' \
     --query 'Invalidation.Id' \
     --output text)
   test -n "$SATISFI_INVALIDATION_ID"
   test "$SATISFI_INVALIDATION_ID" != 'None'
   aws cloudfront wait invalidation-completed \
     --distribution-id "$SATISFI_DISTRIBUTION" \
     --id "$SATISFI_INVALIDATION_ID"
   ```
4. Repeat all smoke tests. A Lambda-only rollback may be incompatible with a
   newer frontend, so verify a complete student journey with synthetic data.
5. Follow the emergency action with a reviewed revert or fix on `main`; otherwise
   the next automatic deployment will overwrite the manual rollback.

## Data and secret safety

- Application rollback is not database rollback. Do not reverse migrations,
  delete catalog rows, or restore a database snapshot through this runbook.
- Do not roll Secrets Manager values backward unless credential rotation is the
  diagnosed failure and the owner explicitly approves it.
- Do not log secret values, student audits, scheduler payloads derived from real
  students, or complete parser responses.
- Do not update CloudFormation, IAM, networking, API Gateway, CloudFront, or RDS
  as part of application recovery unless a separately reviewed infrastructure
  change is required.

## Current recovery limitations

- Deployments update several mutable targets and are not atomic.
- Concurrency cancellation can interrupt an in-progress deployment.
- Exact frontend artifacts are not retained as named release artifacts.
- No committed manifest records the three image URIs and frontend artifact for
  each successful release.
- ECR repositories and lifecycle policies are managed outside the committed
  infrastructure; recovery depth must be verified in the deployed account.

A future infrastructure proposal may address these limitations, but changing
the production deployment design requires owner approval.
