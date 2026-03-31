# Schedule Generation Flow

## Purpose
Describe the end-to-end flow for generating student schedules.

## Inputs
- Degree Works audit PDF
- Student corrections to parsed data
- Desired classes/departments
- Unavailable times
- Credit range
- Preferences

## Hard Constraints
- Unavailable meeting times
- Credit lower/upper bounds
- Eligibility from requirements, completed courses, and offered classes

## Soft Preferences
Students may select multiple:
- Prefer back-to-back classes
- Prefer morning classes (7:00-10:50 AM)
- Prefer mid-day classes (11:00 AM-3:50 PM)
- Prefer evening classes (4:00-9:50 PM)
- Minimize days on campus
- Prefer in-person sections
- Prefer remote sections

## Outputs
- Top 3 satisfiable schedule options for the selected semester
