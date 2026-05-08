workspace "Capstone Schedule Generator" "C4 model and flow for schedule generation" {

    model {
        student = person "Student" "Uploads audit data and requests schedules."

        schedule_system = softwareSystem "Schedule Generator" "Builds semester schedules from requirements and preferences." {
            web_app = container "Web App" "Collects input and displays schedule options." "TypeScript/React"
            audit_parser = container "Audit Parser" "Parses Degree Works PDF into structured academic data." "Python"
            profile_service = container "Profile Service" "Stores emplid, major(s), minor(s), profile, preferences, classes_taken, requirements_needed." "Python"
            scheduler = container "Scheduler" "Builds and solves MaxSAT model; returns top schedules." "Python + MaxSAT"
            database = container "Database" "Stores course, requirements, prerequisites, corequisites, and user data from audit"
            scraper = container "Scraper" "Retreives course details and live section information"
        }

        student -> web_app "Uploads audit, reviews parsing, sets constraints/preferences"
        web_app -> audit_parser "Submits Degree Works PDF"
        audit_parser -> profile_service "Saves parsed academic profile"
        web_app -> profile_service "Saves corrections and preferences"
        profile_service -> scheduler "Provides requirements_needed, classes_taken, and constraints"
        web_app -> student "Displays schedule options"
        database -> scheduler "Provides sections and section meetings for the semester" 
        scheduler -> database "Returns top 3 schedules"
        database -> web_app "Provides top 3 schedules including a possible favorite"
    }

    views {
        container schedule_system "containers" "Container view for the schedule generator." {
            include *
            autoLayout lr
        }

        dynamic schedule_system "schedule_generation_flow" "End-to-end schedule generation flow." {
            student -> web_app "1. Upload Degree Works audit PDF"
            web_app -> audit_parser "2. Parse PDF"
            audit_parser -> web_app "3. Return parsed data for review"
            student -> web_app "4. Correct parsed data if needed"
            web_app -> profile_service "5. Save corrected academic profile"
            student -> web_app "6. Select departments/courses, preferences, and credit range"
            student -> web_app "7. Select preferences (back-to-back, time-of-day, fewer days, modality)"
            web_app -> profile_service "8. Save hard constraints and soft preferences"
            profile_service -> scheduler "9. Build MaxSAT model input and run MaxSAT solver for selected semester"
            database -> web_app "10. Return top 3 satisfiable schedules"
            web_app -> student "11. Present schedule options"
            autoLayout lr
        }

        theme default
    }

}