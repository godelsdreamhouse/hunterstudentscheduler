# Scheduler API (`api.py`)

## Purpose
`api.py` exposes the scheduler pipeline as an HTTP endpoint for UI/backend integration.

Current endpoint:
- `POST /api/schedule/generate`

It runs:
1. parser/UI payload -> `StudentProfile` (`input_builder.py`)
2. DB candidate query (`candidate_builder.py`)
3. constraint build (`constraints_new.py`)
4. MaxSAT solve via RC2
5. decode + serialize selected sections (`run_rc2.py`)

---

## Run Locally

From `schedulingLogic/`:

```bash
source ../.venv/bin/activate
export DATABASE_URL='postgresql://<user>:<password>@<host>:5432/<db>'
uvicorn api:app --reload --port 8000
```

Open:
- `http://127.0.0.1:8000/docs` (Swagger UI)

---

## Endpoint

### `POST /api/schedule/generate`

### Request body
```json
{
  "parser_payload": {
    "majors": ["CS"],
    "classes_taken": [
      { "subject_area": "CSCI", "catalog_number": 23500 }
    ],
    "requirements_needed": [
      {
        "name": "CS Core",
        "attribute": "CS Major Core",
        "credits_needed": 6,
        "fulfilled_by": [
          { "subject_area": "CSCI", "catalog_number": 33500 },
          { "subject_area": "CSCI", "catalog_number": 26000 }
        ]
      }
    ],
    "major_elective_credits": 0,
    "general_elective_credits": 0
  },
  "ui_payload": {
    "emplid": 23942520,
    "credit_lower_bound": 12.0,
    "credit_upper_bound": 16.0,
    "unavailable": [],
    "morning": true,
    "afternoon": false,
    "evening": false,
    "less_gaps": true,
    "less_days": true,
    "in_person": true,
    "remote": false,
    "departmental": [],
    "specific_courses": [],
    "major_electives_needed": [],
    "general_electives_needed": []
  },
  "term_season": "FALL",
  "term_year": 2026
}
```

### Success response shape
```json
{
  "score": 4,
  "credits": 3.0,
  "sections": [
    {
      "class_num": 12696000,
      "section_code": "01",
      "instruction_modality": "INPERSON",
      "instructor": "NULL",
      "enrollment_total": 115,
      "class_capacity": 275,
      "major_elective": false,
      "attributes": [],
      "course": {
        "subject_area": "CSCI",
        "catalog_number": 33500,
        "course_title": "Software Analysis and Design 3",
        "department": "Computer Science",
        "academic_career": "UNDERGRADUATE",
        "credits": 3.0,
        "description": "...",
        "tags": ["CS Core"],
        "prereqs": [
          { "subject_area": "CSCI", "catalog_number": 23500 }
        ]
      },
      "meetings": [
        { "day": "TUESDAY", "start_time": 870, "end_time": 945 },
        { "day": "THURSDAY", "start_time": 870, "end_time": 945 }
      ]
    }
  ],
  "error_code": null,
  "error_message": null,
  "error_details": {},
  "optimization_codes": [
    "PREF_MORNING_ACTIVE",
    "PREF_INPERSON_ACTIVE",
    "OPT_MINIMIZE_DAYS_ACTIVE",
    "OPT_MINIMIZE_GAPS_ACTIVE",
    "MAXSAT_RC2_OPTIMIZED"
  ],
  "optimization_details": {
    "score": 4,
    "morning_sections": 0,
    "inperson_sections": 1,
    "distinct_days": 2
  }
}
```

---

## Error Codes (when no schedule is returned)

- `NO_CANDIDATE_SECTIONS`
- `ALL_CANDIDATES_FAIL_PREREQS`
- `ALL_CANDIDATES_IN_BLOCKED_TIME`
- `NO_ELIGIBLE_CANDIDATES`
- `UNSAT_HARD_CONSTRAINTS`

On these responses:
- `sections` is `[]`
- `score` and `credits` are `0`
- `optimization_codes` is `[]`

### UI handling guidance for error responses

When `sections` is empty and `error_code` is not `null`:
- Show an error banner or empty-state card.
- Use `error_message` as default user text.
- Optionally show `error_details` in an expandable "details" area.

Recommended UI mapping:
- `NO_CANDIDATE_SECTIONS`
  - Meaning: no sections matched requested term/requirements.
  - Suggested copy: "No matching classes were found for your current requirements and term."
- `ALL_CANDIDATES_FAIL_PREREQS`
  - Meaning: candidate classes exist but all fail prerequisite checks.
  - Suggested copy: "We found classes, but prerequisites are not satisfied for all of them."
- `ALL_CANDIDATES_IN_BLOCKED_TIME`
  - Meaning: candidate classes all conflict with unavailable times.
  - Suggested copy: "All matching classes conflict with your unavailable time settings."
- `NO_ELIGIBLE_CANDIDATES`
  - Meaning: after prerequisite + blocked-time filtering, nothing remains.
  - Suggested copy: "No classes remain after applying your eligibility and time filters."
- `UNSAT_HARD_CONSTRAINTS`
  - Meaning: candidates exist, but no combination satisfies all hard constraints.
  - Suggested copy: "No valid schedule satisfies all required constraints. Try relaxing filters."

---

## Optimization Codes

Codes indicate active optimization dimensions used for this run:
- `PREF_MORNING_ACTIVE`
- `PREF_AFTERNOON_ACTIVE`
- `PREF_EVENING_ACTIVE`
- `PREF_INPERSON_ACTIVE`
- `PREF_REMOTE_ACTIVE`
- `OPT_MINIMIZE_DAYS_ACTIVE`
- `OPT_MINIMIZE_GAPS_ACTIVE`
- `OPT_MULTI_REQUIREMENT_TAG_PRIORITY`
- `MAXSAT_RC2_OPTIMIZED`

Use `optimization_details` for counts/metrics to display explanatory UI text.

### UI handling guidance for optimization responses

When `sections` is non-empty:
- Render schedule from `sections`.
- Use `optimization_codes` to show a "Why this schedule?" summary.
- Use `optimization_details` for metrics (counts, distinct days, etc.).

Suggested label mapping:
- `PREF_MORNING_ACTIVE` -> "Morning preference applied"
- `PREF_AFTERNOON_ACTIVE` -> "Afternoon preference applied"
- `PREF_EVENING_ACTIVE` -> "Evening preference applied"
- `PREF_INPERSON_ACTIVE` -> "In-person preference applied"
- `PREF_REMOTE_ACTIVE` -> "Remote preference applied"
- `OPT_MINIMIZE_DAYS_ACTIVE` -> "Minimize days on campus active"
- `OPT_MINIMIZE_GAPS_ACTIVE` -> "Minimize same-day gaps active"
- `OPT_MULTI_REQUIREMENT_TAG_PRIORITY` -> "Multi-requirement course priority active"
- `MAXSAT_RC2_OPTIMIZED` -> "Global MaxSAT optimization executed"

---

## Notes
- Meeting times are integers in minutes after midnight.
- `class_num` is the stable unique key for selected sections.
- DB connection is read from `DATABASE_URL` environment variable.
