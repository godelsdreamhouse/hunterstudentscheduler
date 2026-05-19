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

## Setup
TODO

## Figma Wireframe

[Figma wireframe](figma.com/design/4XBeLCmV2qDhUtTc8dOgwb/Watchtower-Wireframe)

## Architecture Diagrams

C4 architecture source is stored in [docs/architecture/workspace.dsl](docs/architecture/workspace.dsl).

To view it, copy and paste it into https://playground.structurizr.com/.

## Code Style

- TypeScript/React: The frontend uses TypeScript with `strict`, `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch` enabled in `tsconfig.json`. Components are organized under `src/app`, with reusable UI primitives in `src/app/components/ui`.
- CSS/UI: Styling is handled with Tailwind CSS and shared theme files under `src/styles`.
- Node backend: The Express backend currently uses CommonJS modules, `async` route handlers, environment-based configuration, and parameterized PostgreSQL queries.
- Python scheduler: The scheduler uses plain Python modules with dataclasses/enums in `models.py`. 
- Rust scraper: `scraper/Cargo.toml` forbids unsafe code and enables Clippy lint groups including `pedantic`, `nursery`, `enum_glob_use`, and `unwrap_used`.
- Java parser: The parser is a Maven Spring Boot project using Java 17 and package namespace `edu.hunter.watchtower`.
- SQL database: Database structure is maintained directly in `database/schema.sql`.
- Formatting/linting: The root frontend package currently defines `dev` and `build` scripts only; no project-wide formatter or linter command is configured.

## Project Status

Watchtower is still under active integration. The main architectural pieces exist, but not every service is wired into a single one-command development environment yet. The scraper-loaded database should be treated as the current source of truth for course and section data.