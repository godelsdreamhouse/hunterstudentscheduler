workspace "Watchtower Scheduling" "C4 model and flows for academic schedule generation" {

    model {
        student = person "Student" "Hunter College student who uploads a DegreeWorks audit, chooses preferences, and reviews generated schedules."
        maintainer = person "Developer" "Runs local setup, schema changes, scraper refreshes, and elective lookup refreshes."

        degreeworks = softwareSystem "DegreeWorks" "External CUNY/Hunter degree audit system that produces the PDF audit uploaded by the student." "External"
        coursedog = softwareSystem "Hunter CourseDog APIs" "External course catalog, term, requirement, and section source used by the scraper." "External"

        watchtower = softwareSystem "Watchtower Scheduling" "Academic planning system that turns audit data, course data, preferences, and live sections into valid schedule options." {
            web_app = container "Web App" "Protected React application for login, audit upload, requirements review, preference entry, course search, and schedule display. Stores parsed audit data and preferences in browser localStorage scoped to the signed-in user." "React 18, Vite, TypeScript, Tailwind CSS"
            backend_api = container "Backend API" "Handles account registration, login, logout, profile lookup, session cookies, and authenticated course/elective search endpoints." "Node.js, Express, pg, express-session"
            parser_api = container "Audit Parser API" "Accepts DegreeWorks PDF uploads at /AuditParse and returns structured parser payloads used by the scheduler." "Java 17, Spring Boot, Apache PDFBox"
            scheduler_api = container "Scheduler API" "Accepts parser and UI payloads at /api/schedule/generate, loads candidate sections, builds MaxSAT constraints, solves with RC2, and returns UI-ready schedule sections." "Python, FastAPI, psycopg, PySAT/RC2"
            database = container "PostgreSQL Database" "Stores users, Express sessions, courses, departments, sections, section meetings, program elective rules, and the materialized elective lookup." "PostgreSQL 16"
            scraper = container "Course Data Scraper" "CLI/Axum workflow that fetches CourseDog course, requirement, term, and section data and upserts it into PostgreSQL." "Rust, Axum, SQLx, Reqwest, Tokio"
            database_scripts = container "Database SQL Scripts" "Defines schema, session table migration, program elective seed rules, and the program_elective_courses refresh script." "SQL"
        }

        degreeworks -> student "Provides audit PDF"
        student -> web_app "Registers/logs in, uploads audit, reviews requirements, sets preferences, requests schedules"

        web_app -> backend_api "Calls /api/users and /api/courses with credentials" "HTTPS/JSON"
        backend_api -> database "Reads/writes users, sessions, courses, and elective lookup data" "SQL"

        web_app -> parser_api "Uploads DegreeWorks PDF" "POST /AuditParse"
        parser_api -> web_app "Returns structured parser payload" "JSON"

        web_app -> scheduler_api "Submits parser_payload, ui_payload, and target term" "POST /api/schedule/generate"
        scheduler_api -> database "Loads candidate courses, sections, meetings, prerequisites, and elective data" "SQL"
        scheduler_api -> web_app "Returns generated schedule sections, score, and error/optimization details" "JSON"

        maintainer -> scraper "Runs scrape or serve workflow for semester data refresh"
        scraper -> coursedog "Fetches catalog, requirements, terms, and sections" "HTTPS/JSON"
        scraper -> database "Upserts departments, courses, requirements, sections, and meeting times" "SQL"
        maintainer -> database_scripts "Runs schema, migrations, elective seed, and refresh scripts"
        database_scripts -> database "Creates/updates schema and refreshes materialized lookup" "SQL"
    }

    views {
        container watchtower "containers" "Container view for the current Watchtower services and data stores." {
            include *
            autoLayout lr
        }

        dynamic watchtower "schedule_generation_flow" "Current end-to-end schedule generation flow." {
            degreeworks -> student "1. Export/download DegreeWorks audit PDF"
            student -> web_app "2. Register or log in"
            web_app -> backend_api "3. Authenticate and load profile"
            backend_api -> database "4. Create/read user and session records"
            student -> web_app "5. Upload audit PDF"
            web_app -> parser_api "6. Parse audit PDF"
            parser_api -> web_app "7. Return parser payload for review"
            student -> web_app "8. Select term, credit range, blocked times, departments, electives, and course preferences"
            web_app -> backend_api "9. Search courses and program electives as needed"
            backend_api -> database "10. Query active courses and program_elective_courses"
            student -> web_app "11. Request schedule generation"
            web_app -> scheduler_api "12. Send parser_payload, ui_payload, term_season, and term_year"
            scheduler_api -> database "13. Load candidate sections and meeting data"
            scheduler_api -> web_app "14. Return schedule sections, score, and details after solving the MaxSAT model"
            web_app -> student "15. Display generated schedule"
            autoLayout lr
        }

        dynamic watchtower "course_data_refresh_flow" "Semester course and elective data refresh flow." {
            maintainer -> scraper "Run scraper refresh"
            scraper -> coursedog "Fetch current catalog, requirements, terms, and sections"
            scraper -> database "Upsert course and section data"
            maintainer -> database_scripts "Run program elective seed migration"
            database_scripts -> database "Update program elective rules and exclusions"
            maintainer -> database_scripts "Run program_elective_courses refresh"
            database_scripts -> database "Refresh materialized elective lookup"
            autoLayout lr
        }

        theme default
    }

}
