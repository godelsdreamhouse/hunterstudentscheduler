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

---

## Notes
- Meeting times are integers in minutes after midnight.
- `class_num` is the stable unique key for selected sections.
- DB connection is read from `DATABASE_URL` environment variable.
