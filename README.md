# Watchtower Scheduling

Watchtower is an academic planning system for Hunter College students. It helps turn DegreeWorks audit data, course catalog data, prerequisite rules, student preferences, and live section offerings into valid schedule options that are easier to review than manual semester planning.

The system is designed to support academic planning. It does not replace official Hunter College enrollment, advising, or degree audit systems.

## Core Features

- DegreeWorks audit parsing through the Spring Boot parser workspace.
- Account registration, login, logout, and PostgreSQL-backed sessions.
- Protected frontend flows for dashboard, audit upload, preference entry, and schedule viewing.
- Course search through the Express backend.
- PostgreSQL schema for users, courses, sections, meeting times, and schedule-related data.
- Rust scraper workflow for loading course and section data.
- Python scheduler API that builds candidate sections, applies hard constraints, and optimizes soft preferences with MaxSAT.


## Tech Stack

- Frontend: React 18, Vite, React Router, Tailwind CSS, Radix UI, MUI icons.
- Backend API: Node.js, Express, `pg`, `express-session`, `connect-pg-simple`, bcrypt.
- Database: PostgreSQL 16 with Docker Compose.
- Scheduler: Python, FastAPI, Uvicorn, psycopg, PySAT/RC2.
- Scraper: Rust, Axum, SQLx, Reqwest, Tokio, Clap.
- Parser: Java 17, Spring Boot, Apache PDFBox.

## Prerequisites

- Node.js and npm
- Docker Desktop or another Docker Compose-compatible runtime
- Python 3.10+
- Rust toolchain
- Java 17+

## Frontend Setup

The React/Vite frontend is located at the repository root, with application
source code in [`src`](src).

### Install And Run

```bash
npm install
cp .env.example .env
npm run dev
```

For local development, the frontend can use the Vite development proxies for
the parser and scheduler when `VITE_PARSER_URL` and `VITE_SCHEDULER_URL` are
left blank:

```env
VITE_API_URL=http://localhost:3001
VITE_PARSER_URL=
VITE_SCHEDULER_URL=
```

Create a production frontend build with:

```bash
npm run build
```

Component-specific setup instructions are available in:
- [Backend](backend/README.md)
- [Database](database/README.md)
- [Parser](parser/README.md)
- [Scheduler](schedulingLogic/README.md)
- [Scraper](scraper/README.md)

## Deployment

Production deployment is managed by
[`deploy.yml`](.github/workflows/deploy.yml) in GitHub Actions:

- Pull requests that change application, infrastructure, or deployment files
  run the complete verification job but never deploy.
- Every push to `main`, including a merged pull request, runs verification and
  automatically deploys only after verification succeeds.
- The workflow can still be run manually from `main`. Its
  `bootstrap_images_only` option pushes the initial container images and
  secrets without updating application services or the frontend.
- Production deployments share one concurrency group. A newer run cancels an
  older in-progress run, preventing an older revision from overwriting a newer
  deployment.

Verification builds the frontend and all Lambda container images, installs the
backend dependencies, compiles the scheduler, validates the CloudFormation
template, and compiles the Java parser. Deployment then assumes the existing
GitHub OIDC AWS role, publishes the backend, scheduler, and parser images to
ECR, updates their Lambda functions, uploads the frontend to S3, invalidates
CloudFront, and smoke-tests the deployed site and service health endpoints.
Any failed verification, AWS command, upload, or smoke test fails the GitHub
Actions run.

Repository secrets and the existing AWS resources are managed outside this
workflow. Do not place production credentials in the repository.

## Figma Wireframe

[Watchtower Wireframe](https://www.figma.com/design/4XBeLCmV2qDhUtTc8dOgwb/Watchtower-Wireframe?node-id=0-1&p=f&t=H8TqfUbsUTFmDvwC-0)

## Architecture Diagrams

C4 architecture source is stored in [docs/architecture/workspace.dsl](docs/architecture/workspace.dsl).

To view it, copy and paste it into https://playground.structurizr.com/.

## Code Style

- TypeScript/React: The frontend adopts the Airbnb JavaScript and React/JSX style guides as its documented standard for ongoing development and review, where applicable to the current TypeScript/Vite codebase. TypeScript checks including `strict`, `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch` are enabled in `tsconfig.json`, and documented public utilities use TSDoc comments.
- CSS/UI: Styling is handled with Tailwind CSS and shared theme files under `src/styles`.
- Node backend: The Express backend adopts the Airbnb JavaScript Style Guide as its documented standard for ongoing development and review, where applicable to the current CommonJS codebase. It uses `async` route handlers, environment-based configuration, parameterized PostgreSQL queries, and JSDoc for documented public routes.
- Python scheduler: The scheduler uses plain Python modules with dataclasses/enums in `models.py`. 
- Rust scraper: `scraper/Cargo.toml` forbids unsafe code and enables Clippy lint groups including `pedantic`, `nursery`, `enum_glob_use`, and `unwrap_used`.
- Java parser: The parser is a Maven Spring Boot project using Java 17 and package namespace `edu.hunter.watchtower`.
- SQL database: Database structure is maintained directly in `database/schema.sql`.
- Formatting/linting: The root frontend package currently defines `dev` and `build` scripts only; no project-wide formatter or linter command is configured.

## Project Status

Watchtower is still under active integration. The main architectural pieces exist, but not every service is wired into a single one-command development environment yet. The scraper-loaded database should be treated as the current source of truth for course and section data.
