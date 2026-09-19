# AWS database setup

This fork will use its own Amazon RDS PostgreSQL database. Do not reuse the
class project's database or credentials.

## Verified development configuration (September 19, 2026)

The existing `database-1` is available. Do not create another instance. AWS
reported $120 remaining Free plan credits, expiring March 19, 2027. Cost Explorer
is not enabled; this is a credit balance, not an ongoing cost quote.

| Setting | Starting value |
| --- | --- |
| Region | US East (N. Virginia), `us-east-1` |
| Service / engine | Amazon RDS / PostgreSQL |
| PostgreSQL version | PostgreSQL 18.3 |
| Deployment | Single-AZ DB instance |
| Instance class | `db.t4g.micro`, if available under the account plan |
| Storage | 20 GiB general-purpose SSD (gp3) |
| Storage autoscaling | Disabled initially; monitor available space |
| DB instance identifier | `database-1` |
| Initial database name | `hunterscheduler` |
| Master username | `postgres` (administration only) |
| Credentials | A new generated password stored in a password manager |
| Encryption | Enabled |
| Automated backup retention | 1 day (the account rejected 7 days under the Free plan) |
| Deletion protection | Enabled |

Use Standard create to inspect these settings. Confirm paid monitoring,
proxies, additional replicas, and other optional services are not selected.
Set a monthly cost alert while configuring the account; an alert is a
notification, not a spending cap.

## Network and scraper prerequisites

These must be completed before a hosted scrape can succeed:

1. The scraper now enables SQLx TLS support. RDS PostgreSQL 16 requires
   SSL by default.
2. Use the actual RDS hostname in `POSTGRES_HOST`, `POSTGRES_DB=hunterscheduler`,
   `POSTGRES_SSLMODE=verify-full`, and the path to the AWS RDS CA bundle in
   `POSTGRES_SSLROOTCERT`. The workflow configures the certificate settings
   automatically. Runtime passwords do not need URL encoding.
3. Set up access from the GitHub Actions runner. Standard GitHub-hosted
   runners have changing IP addresses, so allowing a developer's home IP
   alone will not let the weekly job connect.

For a small development setup, the proposed approach is a publicly
addressable RDS instance with a dedicated security group. Allow port 5432
only from the developer's current IP for initial setup. The weekly workflow
can use a narrowly scoped AWS role through GitHub OIDC to temporarily allow
its own runner IP, then remove that rule when the job finishes. Scope the
role to this fork, its default branch, and this security group. The workflow now uses role `hunter-scheduler-github-scraper`, scoped to
`godelsdreamhouse/hunterstudentscheduler:ref:refs/heads/main`, and security group
`sg-0979034bbdf568a2b`. It permits only its own IPv4 `/32` on port 5432 and uses an
`always()` cleanup step. If a runner is forcibly terminated, cleanup cannot be
guaranteed; the next run removes this workflow's rules older than three hours.
Inspect/remove leftover `hunter-scraper:` rules after a canceled or lost runner.
The weekly trigger remains disabled until a manual hosted run passes. Never open database access to all IPs
as a substitute for runner access configuration.

## Initial schema and verification

After the database and secure connectivity are available:

1. Verify the endpoint, database name, and TLS connection.
2. Run `psql -X -f database/initialize-empty.sql` with the connection configured
   via the standard `PGHOST`, `PGPORT`, `PGUSER`, `PGDATABASE`, `PGSSLMODE`,
   and `PGSSLROOTCERT` environment variables. Let psql prompt for the password.
   The script checks that the public schema is empty and loads the schema
   in a transaction. Do not run raw `schema.sql` on an existing database.
3. Create a separate scraper database role with the required table and
   sequence permissions. Keep master credentials out of the scheduled job.
4. Configure connection secrets in `godelsdreamhouse/hunterstudentscheduler`.
5. Run the fork's Scrape workflow manually and inspect course, section,
   and meeting counts before relying on the weekly schedule.
6. Apply the elective seed migration and refresh the elective materialized
   view as described in the database README.

The disposable PostgreSQL service in the Scrape workflow is for compilation
only; it must never be used as persistent scraped-data storage.

## References

- [AWS RDS Free Tier](https://aws.amazon.com/rds/free/)
- [RDS PostgreSQL pricing](https://aws.amazon.com/rds/postgresql/pricing/)
- [RDS public and private access](https://docs.aws.amazon.com/AmazonRDS/latest/gettingstartedguide/security-public-private.html)
- [RDS PostgreSQL SSL](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.SSL.html)
- [GitHub-hosted runner networking](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)

## Database access

Endpoint: `database-1.cqh0ea4womao.us-east-1.rds.amazonaws.com:5432`.
The initial developer rule is a single IPv4 `/32`; update it when the developer IP changes.
Authenticated `verify-full` TLS 1.3 connectivity and guarded schema initialization
were verified. `hunter_scraper` has SELECT/INSERT/UPDATE on the four scrape tables,
DELETE on section meetings for transactional replacement, and USAGE on their two
sequences. It has SELECT/MAINTAIN on the elective materialized view (PostgreSQL 18).
It has no permissions on user accounts, sessions, or saved schedules.

`create-scraper-role.sql` creates the role on a freshly initialized database;
set its password separately using a hidden prompt or secure runtime input. Never
commit credentials. GitHub Actions uses the four `POSTGRES_*` repository secrets
with this role, not the RDS administrator.

After the first scrape, run `migrations/001_program_elective_lookup.sql` as the
owner, then `verify-scrape.sql`. The scraper replaces each returned section's
meetings atomically, so repeating a scrape does not accumulate duplicates.
