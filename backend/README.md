# Watchtower Backend

Node.js/Express server for public course search APIs and the currently disabled
account/session implementation. It runs on port **3001** by default.

The other two services in this project are independent:
- **Spring Boot parser** (port 8080): parses DegreeWorks PDF audits
- **Python FastAPI scheduler** (port 8000): generates schedules from parsed data

## Running Locally

```bash
cd backend
npm install
npm run dev      # nodemon, auto-restarts on changes
# or
npm start        # plain node, no auto-restart
```

The server starts on the port set in `PORT`, or `3001` when `PORT` is not set.

## Environment Variables

Create a `.env` file in `backend/` with the following values.

```env
# Server
PORT=3001
NODE_ENV=development

# Keep false for the no-login beta. Account code remains available for a future
# reviewed identity-proofing design.
ENABLE_ACCOUNT_ROUTES=false

# Session - use a long random string in production
SESSION_SECRET=your-secret-here

# CORS - exact origin allowed to send credentials in production. When omitted,
# PUBLIC_APP_ORIGIN is used. In development, any localhost port is allowed.
CORS_ORIGIN=https://your-app.example

# Supabase/PostgreSQL connection used by auth, sessions, and course search
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
```

Database connection:
- [src/db.js](src/db.js) uses `DATABASE_URL` for users, sessions, and course search.

## Database Setup

Supabase PostgreSQL is required. Create the auth/session tables by running the project schema and migrations in [`../database`](../database). The Express session table is defined in [`../database/migrations/002_add_session_table.sql`](../database/migrations/002_add_session_table.sql).

The session middleware (`connect-pg-simple`) creates the `session` table automatically on first run if it does not already exist.

Application tables should match the project schema in [`../database/schema.sql`](../database/schema.sql). In particular, the backend currently expects:
- `users` for auth and profile lookup
- `session` for Express sessions
- `courses` for `/api/courses/search`
- `departments`, `sections`, and `program_elective_courses` data/view support for course and elective flows

## API Endpoints

All API endpoints are prefixed with `/api`. Authenticated routes require an active session cookie named `sid`. Authentication rotates the session identifier, and user responses are marked `Cache-Control: no-store`.

### Auth & Users - `/api/users` (disabled by default)

The no-login beta returns `404` for every `/api/users/*` route and does not
initialize PostgreSQL-backed browser sessions. The implementation remains in the
repository, but it is mounted only when `ENABLE_ACCOUNT_ROUTES=true`. Do not
enable it in a public environment until registration proves control of the CUNY
identity being linked.

#### `POST /api/users/register`

Creates a new user account and starts a session.

Body:
```json
{
  "emplid": "12345678",
  "email": "jane.doe01@login.cuny.edu",
  "first_name": "Jane",
  "last_name": "Doe",
  "password": "plaintext-password"
}
```

Responses:
- `201`: `{ first_name, last_name, email }`
- `400`: missing required fields
- `409`: email already in use
- `500`: internal server error

#### `POST /api/users/login`

Authenticates a user and starts a session.

Body:
```json
{
  "email": "jane.doe01@login.cuny.edu",
  "password": "plaintext-password"
}
```

Responses:
- `200`: `{ first_name, last_name, email }`
- `400`: missing fields
- `401`: invalid credentials
- `500`: internal server error

#### `POST /api/users/logout`

Destroys the current session and clears the session cookie.

Responses:
- `200`: `{ message: "Logged out" }`
- `500`: could not destroy the session

#### `GET /api/users/profile` *(requires auth)*

Returns the current user's profile.

Responses:
- `200`: `{ emplid, first_name, last_name, email }`
- `401`: not authenticated
- `404`: user not found
- `500`: internal server error

### Courses - `/api/courses`

These read-only catalog endpoints are public and do not require a login.

#### `GET /api/courses/search?q=<query>`

Searches active courses by code or name. This endpoint is used for specific-course pinning in the preferences page.

Query params:
- `q`: search term

Responses:
- `200`: `{ courses: [{ course_id, course_code, course_name, credits }] }`
- `500`: internal server error

#### `GET /api/courses/electives?q=<query>&program_key=<key>`

Searches eligible major elective course codes from the remote `program_elective_courses` source. This endpoint is used by the major-electives picker in the preferences page.

Query params:
- `q`: course-code search term
- `program_key`: program key or supported major name/code

Supported mapped program keys:
- `CS` or `Computer Science` -> `ComputerScience_ComputerScience`
- `MATH` or `Mathematics` -> `Mathematics_Mathematics`
- `POLISCI`, `POLSC`, or `Political Science` -> `PoliticalScience_None`

`POLISCI` is the scheduler's Political Science major identifier, while
`POLSC` is the course subject prefix used for course codes such as
`POLSC 27500`.

Responses:
- `200`: `{ courses: [{ course_code }] }`
- `500`: internal server error

### Public Catalog - `/api/catalog`

These read-only endpoints do not require an account or session.

#### `GET /api/catalog/terms`

Lists terms that currently have scraped sections.

#### `GET /api/catalog/sections?term_season=FALL&term_year=2026&q=CSCI&limit=50&offset=0`

Searches sections in one term by course code, title, department, or instructor.
Each result includes its course data, enrollment fields, and meeting days,
times, and locations. `q` is optional; `term_season` and `term_year` are
required. Results are paginated with a default limit of 50 and maximum of 100.

### Health Check

#### `GET /health`

Returns `{ status: "ok" }`. No auth required.

## Code Style

Backend JavaScript follows the Airbnb JavaScript Style Guide where applicable,
adapted for the existing CommonJS Express structure.

Project conventions include:
- Use `const` unless reassignment is required.
- Use `async`/`await` for database-backed route handlers.
- Use parameterized SQL queries rather than interpolating request values.
- Document public API route handlers with JSDoc comments describing authentication, inputs, outputs, and side effects.
- Store configuration and secrets in environment variables rather than source code.
