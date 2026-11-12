# Local development

This guide runs Satisfi against local or synthetic data. It does not require or
authorize production database writes. Run commands from the repository root
unless a command starts with `cd`.

## Fast frontend-only verification

The browser suite starts Vite and intercepts catalog, parser, and scheduler
requests with synthetic Computer Science, Mathematics, and Political Science
fixtures:

```bash
npm ci
npm run test:e2e
```

It requires a local Google Chrome installation but no database or backend
services. This is the quickest repeatable check of the student workflow.

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
overwriting it. PostgreSQL is published only on `127.0.0.1`.

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
  --add-host=host.docker.internal:host-gateway \
  -e SPRING_DATASOURCE_USERNAME=watchtower \
  -e SPRING_DATASOURCE_PASSWORD=watchtower_password \
  -e SPRING_DATASOURCE_URL=jdbc:postgresql://host.docker.internal:5432/watchtower \
  -e CORS_ALLOWED_ORIGINS=http://localhost:5176 \
  satisfi-parser:local
```

Docker Desktop provides `host.docker.internal`; the `--add-host` option supplies
it on current Linux engines.

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
npm run dev
```

Open the `Local` URL printed by Vite. Leaving `VITE_PARSER_URL` and
`VITE_SCHEDULER_URL` blank uses Vite's local proxies. Source changes hot reload.
Review an existing `.env` instead of overwriting it.

## Stop and reset

Stop each foreground service with `Ctrl+C`, then stop PostgreSQL:

```bash
docker compose -f database/docker-compose.yml --env-file database/.env down
```

The named volume persists. To discard only this stack's local PostgreSQL data,
review the active compose project first, then run the same command with `-v`.
That deletion is irreversible for the local volume and is intentionally not
part of the normal stop command.

## Isolated frontend preview

The root README documents `git worktree add`, `npm run dev`, and `npm run
preview` for a separate frontend checkout. `vite preview` has no development
proxies: set any non-production `VITE_*` service URLs before `npm run build`.
A coordinated, port-parameterized multi-service worktree stack is not yet
provided.
