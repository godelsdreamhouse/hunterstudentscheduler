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
   `WEB_DATABASE_PASSWORD`, `COMPUTE_DATABASE_PASSWORD`, `SESSION_SECRET`,
   `MICROSOFT_CLIENT_ID`, `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_SECRET`, and
   `DEMO_LOGIN_TOKEN`.
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

## Microsoft sign-in update

Before deploying Microsoft-only sign-in:

1. Configure the Azure app for organizational accounts in multiple tenants.
   Student authentication uses CUNY's tenant from the public discovery document
   for `login.cuny.edu`, not the app owner's tenant. CUNY consent policy may
   require administrator approval.
2. Apply `database/migrations/004_add_microsoft_identities.sql` as the database
   owner. It creates the identity table and grants the web role the required
   identity and catalog-read permissions.
3. Verify outbound HTTPS from the web Lambda to Microsoft for token exchange
   and signing-key retrieval. A VPC-attached Lambda in a public subnet does not
   gain internet access through the internet gateway alone.
   Deploy `web-network.yaml` into `hunter-scheduler-web-network`, passing the
   existing VPC, its Amazon-provided IPv6 /56, and application security group.
   Pass its `WebSubnetIds` output to this application's new `WebSubnetIds`
   parameter. Only the web function enables dual-stack outbound access.
   The dedicated subnets use 172.31.96.0/24 and 172.31.97.0/24 in us-east-1a/b;
   check these ranges are unused before deploying in another environment.
   HTTPS leaves through an egress-only IPv6 gateway; database connections stay
   on private IPv4. This requires no NAT gateway or new inbound firewall rules.
   The existing VPC was associated with Amazon IPv6 block
   `2600:1f18:6bd0:5c00::/56` for this deployment; that association is managed
   separately from the network stack and must remain while its subnets exist.
4. Run **Deploy application** with **bootstrap_images_only** to store runtime
   secrets. Then update `hunter-scheduler-app` with this template to resolve
   the configuration into Lambda. Finally run the normal deployment.

Test an actual CUNY sign-in and first-time profile completion before removing
fallback access from the live site. Legacy accounts are not automatically
linked using their unverified email addresses.
`DEMO_LOGIN_TOKEN` enables the private testing URL
`/api/users/test-login?token=…`; it is not a general sign-in method.

## Operations

The CloudFormation stack is `hunter-scheduler-app`. The site URL, bucket, API
endpoint, and CloudFront distribution ID are stack outputs. Container images are
tagged with the deploying Git commit. Deployment concurrency prevents overlapping
updates.

The site bucket and log groups are retained if the stack is removed. ECR keeps
the ten newest images per service. API throttling and small per-function database
connection pools limit unexpected load and database usage.
