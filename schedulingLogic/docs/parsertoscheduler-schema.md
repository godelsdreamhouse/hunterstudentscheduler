# Parser/UI to Scheduler Schema

## Purpose
Defines the shared payload contract for:
- `build_student_profile(parser_payload, ui_payload)`
- `POST /api/schedule/generate`

## parser_payload

### Required fields
- `majors`: `list[str]` (example: `["CS"]`)
- `classes_taken`: `list[CourseIdPayload]`
- `requirements_needed`: `list[RequirementPayload]`

### CourseIdPayload
- `subject_area`: `str` (example: `"CSCI"`)
- `catalog_number`: `int` (example: `33500`)

### RequirementPayload
- `name`: `str` (required)
- `attribute`: `str` (optional, default `""`)
- `credits_needed`: `int` (optional, default `0`)
- `fulfilled_by`: `list[CourseIdPayload]` (required; transformed to `frozenset[CourseId]` in scheduler model)

### Notes on Course Data
- Parser input to scheduler now passes `CourseIdPayload` under `RequirementPayload.fulfilled_by`.
- Full `Course` details (`course_title`, `department`, `credits`, `description`, `tags`, `prereqs`) are fetched/populated from DB candidate loading.

## ui_payload

### Required fields
- `emplid`: `int`

### Optional fields
- `credit_lower_bound`: `float` (default `12.0`)
- `credit_upper_bound`: `float` (default `16.0`)
- `unavailable`: `list[MeetingPayload]` (default `[]`)
- `morning`: `bool` (default `false`)
- `afternoon`: `bool` (default `false`)
- `evening`: `bool` (default `false`)
- `less_gaps`: `bool` (default `false`)
- `less_days`: `bool` (default `false`)
- `in_person`: `bool` (default `false`)
- `remote`: `bool` (default `false`)
- `major_electives_needed`: `list[CourseIdPayload]` (optional, default `[]`)

### MeetingPayload
- `day`: `"MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY"`
- `start_time`: `int` (minutes after midnight)
- `end_time`: `int` (minutes after midnight)

## API Contract

### Endpoint
- `POST /api/schedule/generate`

### Request body
```json
{
  "parser_payload": {
    "majors": ["CS"],
    "classes_taken": [
      { "subject_area": "CSCI", "catalog_number": 23500 },
      { "subject_area": "CSCI", "catalog_number": 16000 }
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
    ]
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
    "major_electives_needed": []
  },
  "term_season": "FALL",
  "term_year": 2026
}
```

### Response body
```json
{
  "score": 4,
  "credits": 6,
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
        "credits": 3,
        "description": "The design and analysis of algorithms...",
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
  ]
}
```

## Integration Notes
- UI should render from `sections` directly.
- Use `class_num` as the stable unique section key.
- Meeting times are integers in minutes after midnight.
- `score` is RC2 optimization cost (lower is better).
