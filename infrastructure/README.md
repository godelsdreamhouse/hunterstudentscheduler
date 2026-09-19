# AWS application hosting

The production application uses low-idle-cost AWS services in `us-east-1`:

- S3 and CloudFront host the React single-page application.
- API Gateway provides one throttled, same-origin API surface.
- Three container-image Lambda functions run the Express backend, FastAPI
  scheduler, and Spring Boot PDF parser.
- The functions use two subnets in the RDS VPC and a dedicated security group.
  RDS accepts port 5432 only from that group.
- Secrets Manager stores the web and compute database passwords. CloudFormation
  resolves them into encrypted Lambda configuration; values are not committed.
- CloudWatch keeps application and API logs for 14 days.

The API Gateway request limit is 10 MB. The parser deliberately applies a 5 MB
upload limit. Scheduler solving is capped at 18 seconds so requests finish within
the HTTP API's 30-second integration timeout.

## First deployment

1. Create `hunter_web` and `hunter_compute` with
   `database/create-application-roles.sql`, then set their passwords separately.
2. Configure these GitHub Actions secrets:
   `WEB_DATABASE_PASSWORD`, `COMPUTE_DATABASE_PASSWORD`, and `SESSION_SECRET`.
3. The AWS account must contain the three ECR repositories and the
   `hunter-scheduler-github-deploy` OIDC role scoped to this repository's `main`
   branch.
4. Merge the hosting change and manually run **Deploy application** on `main`
   with **bootstrap_images_only** selected. This stores the runtime secrets and
   publishes the first three images without granting GitHub infrastructure-wide
   permissions.
5. Create the one-time `hunter-scheduler-app` stack with
   `infrastructure/template.yaml`, passing the pre-created Lambda execution role
   and application security group.
6. Run **Deploy application** normally. It updates the three named functions,
   uploads the frontend, and runs health checks.

Pull requests only build and validate the application and CloudFormation. The
workflow deploys only through an explicit manual run from `main`. Infrastructure
changes are applied separately through an authenticated AWS administrator; the
GitHub OIDC role cannot create IAM, network, API Gateway, or CloudFront resources.

## Operations

The CloudFormation stack is `hunter-scheduler-app`. The site URL, bucket, API
endpoint, and CloudFront distribution ID are stack outputs. Container images are
tagged with the deploying Git commit. Deployment concurrency prevents overlapping
updates.

The site bucket and log groups are retained if the stack is removed. ECR keeps
the ten newest images per service. API throttling and small per-function database
connection pools limit unexpected load and database usage.
