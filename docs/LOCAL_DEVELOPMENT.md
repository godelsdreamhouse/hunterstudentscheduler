# Local development

This guide runs Satisfi against local or synthetic data. It does not require or
authorize production database writes. Run commands from the repository root
unless a command starts with `cd`.

The commands below use Bash syntax and are intended for macOS, Linux, or WSL.
Windows PowerShell and Command Prompt require equivalent environment-variable
and virtual-environment syntax.

## Fast frontend-only verification

The browser suite starts Vite and intercepts catalog, parser, and scheduler
requests with synthetic Computer Science, Mathematics, and Political Science
fixtures:

```bash
npm ci
PLAYWRIGHT_REUSE_SERVER=false npm run test:e2e
```

It requires a local Google Chrome installation but no database or backend
services. Setting `PLAYWRIGHT_REUSE_SERVER=false` ensures the suite starts this
checkout on port 4177 instead of silently testing a server from another
worktree. The command fails if that port is already occupied. This is the
quickest repeatable check of the student workflow.

## Full local stack

The services use these default ports:

| Service | Port |
| --- | ---: |
| Frontend (Vite) | 5176 |
| Catalog backend | 3001 |
| DegreeWorks parser | 8080 |
| Smart Scheduler | 8000 |
| PostgreSQL | 5432 |

These fixed service ports can collide with another checkout. Stop the other
stack or change the relevant service and proxy configuration before starting a
second full stack. Frontend-only worktrees can use the alternate Vite port that
Vite prints.

### 1. Start PostgreSQL

```bash
if [ ! -e database/.env ]; then cp database/.env.example database/.env; fi
docker compose -f database/docker-compose.yml --env-file database/.env up -d
docker compose -f database/docker-compose.yml --env-file database/.env ps
```

The compose file creates database `watchtower` and, with the example file,
user/password `watchtower`/`watchtower_password`. The schema initializes only
when the volume is first created. Review an existing `database/.env` instead of
overwriting it. If that file uses different credentials, substitute those
values in every backend, parser, and scheduler command below. PostgreSQL is
published only on `127.0.0.1`.

The schema is empty of catalog rows. Catalog search, parser course lookup, and
schedule generation need synthetic or scraped local course data. Do not point
these commands at production merely to fill the local database. A reviewed
local-only catalog fixture remains a development gap.

### 2. Start the catalog backend

In a second terminal:

```bash
cd backend
npm ci
if [ ! -e .env ]; then cp .env.example .env; fi
HOST=127.0.0.1 \
POSTGRES_HOST=127.0.0.1 \
POSTGRES_PORT=5432 \
POSTGRES_USER=watchtower \
POSTGRES_PASSWORD=watchtower_password \
POSTGRES_DB=watchtower \
POSTGRES_SSLROOTCERT= \
npm run dev
```

The environment values on the command line intentionally override the hosted
database examples in `backend/.env.example`, including its placeholder TLS
certificate path. Review an existing `.env` instead of overwriting it. The
server binds only to loopback for this local workflow.

### 3. Start the DegreeWorks parser

With Java 17+ installed, use a third terminal:

```bash
SPRING_DATASOURCE_USERNAME=watchtower \
SPRING_DATASOURCE_PASSWORD=watchtower_password \
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/watchtower \
CORS_ALLOWED_ORIGINS=http://localhost:5176 \
SERVER_ADDRESS=127.0.0.1 \
./parser/mvnw -f parser/pom.xml spring-boot:run
```

For Docker instead, pass the same local credentials and a container-to-host URL
explicitly:

```bash
docker build -f parser/Dockerfile -t satisfi-parser:local .
docker run --rm -p 127.0.0.1:8080:8080 \
  --network database_default \
  -e SPRING_DATASOURCE_USERNAME=watchtower \
  -e SPRING_DATASOURCE_PASSWORD=watchtower_password \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://postgres:5432/watchtower \
  -e CORS_ALLOWED_ORIGINS=http://localhost:5176 \
  satisfi-parser:local
```

The default Compose invocation creates network `database_default`; within that
network, `postgres` resolves to the database service without exposing it beyond
the local host. If you set a custom Compose project name, use that project's
default network name instead.

### 4. Start the Smart Scheduler

In a fourth terminal:

```bash
python3 -m venv schedulingLogic/.venv
schedulingLogic/.venv/bin/python -m pip install -r schedulingLogic/requirements.txt
DATABASE_URL=postgresql://watchtower:watchtower_password@127.0.0.1:5432/watchtower \
  schedulingLogic/.venv/bin/uvicorn api:app \
  --app-dir schedulingLogic --host 127.0.0.1 --port 8000
```

`GET http://127.0.0.1:8000/api/schedule/health` checks that the API process is
up. It does not prove that PostgreSQL queries or MaxSAT solving work.

### 5. Start the frontend

In a fifth terminal:

```bash
npm ci
if [ ! -e .env ]; then cp .env.example .env; fi
VITE_API_URL=http://127.0.0.1:3001 \
VITE_PARSER_URL= \
VITE_SCHEDULER_URL= \
npm run dev
```

Open the `Local` URL printed by Vite. Leaving `VITE_PARSER_URL` and
`VITE_SCHEDULER_URL` blank uses Vite's local proxies. Source changes hot reload.
The command-line values deliberately override any hosted service URLs in an
existing root `.env`, so catalog calls, audit uploads, and schedule requests
stay on the local stack. Review an existing `.env` instead of overwriting it.

## Stop and reset

Stop each foreground service with `Ctrl+C`, then stop PostgreSQL:

```bash
docker compose -f database/docker-compose.yml --env-file database/.env down
```

The named volume persists. To discard its local PostgreSQL data, first confirm
that no other checkout is using it, then review the active Compose
project before running the same command with `-v`. With the repository's
default Compose command, every worktree uses project `database`, container
`watchtower-postgres`, network `database_default`, and volume
`database_watchtower_data`; even the normal `down` command can therefore stop
another worktree's database, and `down -v` can irreversibly delete its local
data. A unique `--project-name` alone does not isolate this Compose file because
the container name and host port are fixed. Full-stack worktree isolation is
not currently supported and `down -v` is intentionally not part of the normal
stop command.

## Isolated frontend preview

The root README documents `git worktree add`, `npm run dev`, and `npm run
preview` for a separate frontend checkout. `vite preview` has no development
proxies: set any non-production `VITE_*` service URLs before `npm run build`.
A coordinated, port-parameterized multi-service worktree stack is not yet
provided.
