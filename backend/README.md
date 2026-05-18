# Watchtower Backend

Node.js/Express server for Watchtower authentication, session management, user profile lookup, and course search APIs. It runs on port **3001** by default.

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

# Session - use a long random string in production
SESSION_SECRET=your-secret-here

# CORS - origin allowed to send credentials in production
# In development, any localhost port is allowed automatically.
CORS_ORIGIN=https://your-frontend-domain.com

# Supabase/PostgreSQL connection used by auth, sessions, and course search
DATABASE_URL=postgresql://user:password@host:5432/database?sslmode=require
```

Database connection:
- [src/db.js](src/db.js) uses `DATABASE_URL` for users, sessions, and course search.

## Database Setup

Supabase PostgreSQL is required. Create the auth/session tables by running [`supabase-auth.sql`](supabase-auth.sql) in the Supabase SQL editor.

The session middleware (`connect-pg-simple`) creates the `session` table automatically on first run if it does not already exist.

Application tables should match the project schema in [`../database/schema.sql`](../database/schema.sql). In particular, the backend currently expects:
- `users` for auth and profile lookup
- `session` for Express sessions
- `courses` for `/api/courses/search`
- `departments`, `sections`, and `program_elective_courses` data/view support for course and elective flows

## API Endpoints

All API endpoints are prefixed with `/api`. Authenticated routes require an active session cookie named `sid`.

### Auth & Users - `/api/users`

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

#### `GET /api/courses/search?q=<query>` *(requires auth)*

Searches active courses by code or name. This endpoint is used for specific-course pinning in the preferences page.

Query params:
- `q`: search term

Responses:
- `200`: `{ courses: [{ course_id, course_code, course_name, credits }] }`
- `401`: not authenticated
- `500`: internal server error

#### `GET /api/courses/electives?q=<query>&program_key=<key>` *(requires auth)*

Searches eligible major elective course codes from the remote `program_elective_courses` source. This endpoint is used by the major-electives picker in the preferences page.

Query params:
- `q`: course-code search term
- `program_key`: program key or supported major name/code

Supported mapped program keys:
- `CS` or `Computer Science` -> `ComputerScience_ComputerScience`
- `MATH` or `Mathematics` -> `Mathematics_Mathematics`

Responses:
- `200`: `{ courses: [{ course_code }] }`
- `401`: not authenticated
- `500`: internal server error

### Health Check

#### `GET /health`

Returns `{ status: "ok" }`. No auth required.
