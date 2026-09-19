## Scheduled scraping

The [Scrape workflow](../.github/workflows/scrape.yml) runs the scraper on
GitHub Actions every Sunday at 00:00 UTC and can also be started manually
with **Actions → Scrape → Run workflow**. The scraper exits when finished;
you do not need to host its HTTP server for scheduled scraping.

The workflow uses two separate databases:

- A disposable PostgreSQL 16 service validates SQL queries during the Rust
  build. The workflow loads `database/schema.sql` into this service, which
  is discarded after the job.
- Your persistent PostgreSQL database receives scraped data. It must be
  reachable from the GitHub runner and have the project schema installed.

In your fork, configure these repository secrets under **Settings → Secrets
and variables → Actions**: `POSTGRES_HOST`, `POSTGRES_USER`,
`POSTGRES_PASSWORD`, and `POSTGRES_DB` (`hunterscheduler`). Runtime credentials
are passed directly to the database driver, so use the password exactly as
generated, without URL encoding. `POSTGRES_PORT` defaults to 5432. `DATABASE_URL` is
only used for compile-time SQL validation and is supplied by the workflow.

The AWS workflow downloads the RDS CA bundle and sets `POSTGRES_SSLMODE=verify-full`
and `POSTGRES_SSLROOTCERT` to verify the server certificate and hostname.
For local RDS runs, set these values in `scraper/.env` (see `env.example`).
For a local non-TLS PostgreSQL database, use `POSTGRES_SSLMODE=disable` and
omit `POSTGRES_SSLROOTCERT`. GitHub runner firewall access still needs to be
configured separately; see the [AWS setup notes](../database/AWS.md).

Check that Actions and the scheduled workflow are enabled in your fork,
then use a manual run to verify the setup. A successful build verifies SQL
against the checked-in schema; a successful **Run scrape** step is needed
to verify the hosted database and source API together.

Use `database/initialize-empty.sql` with psql for first-time setup; it refuses
to initialize a nonempty public schema. Only load `database/schema.sql` into a new, empty database: it starts with
`DROP` statements and would erase existing project data. The workflow
loads it only into its disposable build database, never your hosted database.

If a run fails, open the failing step in Actions:

- **Build**: inspect the Rust/SQLx compiler error. This step does not use
  hosted database credentials.
- **Check scrape database configuration**: add the named missing secrets
  to your fork.
- **Run scrape**: inspect connection, source API, or SQL errors. A hosted
  database with an older schema may need migration before scraping.

## Directions
Run the following commands from the `scraper` directory. Local builds use
SQLx compile-time query checking, so set `DATABASE_URL` in `scraper/.env`
to a reachable development database with the project schema installed
(see `env.example`).

To build the binary, run:

```rust
cargo build --release
```

This assumes that you have rust tooling installed.
If not, check out [rustup](https://rustup.rs/).
If you are using an OS such as NixOS where rustup is not preferred, you're on your own.
Good luck.

### Server
To start the server, run:

```rust
./scraper serve -p 8080
```

### Client
The default URL is `http://127.0.0.1:8080`.

Routes:
- `/v1/course_list?skip=0&limit=20`
- `/v1/course_section?course_group_id=1209731&term_id=1262`
- `/v1/current_term`
- `/v1/all_terms`
- `/v1/course_requirements/:id`


Flow to get all info on a course:
1. Course list to get course id
2. Course requirements to get requirements
3. Current term to get current term
4. All terms to get all terms
    a. Filter terms to get current active ones
5. Course section for each active term to gets sections

To scrape all the data and populate the db without starting the server, run:

```sh
cargo run --release --locked -- scrape
```

When running the HTTP server, use `/v1/initialize`.
This can also be used to update all the data.

## Testing
To run test functions, run:

```rust
cargo test
```

To run test function with JSON outputs, run:

```rust
cargo test -- --nocapture
```

To run specific test functions, run:

```rust
cargo test test_function_name
```

>[!note]
>The above command may match other test functions with the same substrings.
>To run a stricter search, run:
>
>```rust
>cargo test test_function_name -- --exact
>```

## Styling
This project uses `rustfmt`'s default style.
