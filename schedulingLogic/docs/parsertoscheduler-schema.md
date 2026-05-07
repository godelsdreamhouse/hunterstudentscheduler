
# micah gentry
# watchtower
# 05/07/2026

# Input Schema for StudentProfile Builder

## Purpose{
  "emplid": 23942520,
  "credit_lower_bound": 12.0,
  "credit_upper_bound": 16.0,
  "unavailable": [
    { "day": "MONDAY", "start_time": 720, "end_time": 810 }
  ],
  "morning": true,
  "afternoon": false,
  "evening": false,
  "less_gaps": true,
  "less_days": true,
  "in_person": true,
  "remote": false,
  "major_electives_needed": [
    { "subject_area": "CSCI", "catalog_number": 35000 },
    { "subject_area": "CSCI", "catalog_number": 35300 }
  ]
}

Defines payload contract for:
- `build_student_profile(parser_payload, ui_payload)`

##  parser_payload 

### Required fields
- `major`: 'Major':"CSCI"
- `classes_taken`: `list[CoursePayload]`
- `requirements_needed`: `list[RequirementPayload]`

### CourseIdPayload
- `subject_area`: `str` (required, example: `"CSCI"`)
- `catalog_number`: `int` (required, example: `13500`)

### RequirementPayload
- `name`: `str` (required)
- `attribute`: 'list[str]' (optional, default '[])
- `fulfilled_by`: `list[CourseIdPayload]` (required, default `[]`)
- 'elective_credits_needed': 'float', (required, default '0')

### CoursePayload
- `course_id`: `CourseIdPayload` (required)
- `course_title`: `str` (required)
- `academic_career`: `"UNDERGRADUATE" | "GRADUATE"` (optional, default `"UNDERGRADUATE"`)
- `credits`: `int` (optional, default `3`)
- `description`: `str` (optional, default `""`)
- `fulfillment_tags`: `list[str]` (optional, default `[]`)
- `prereqs`: `list[tuple[str, int]]` (optional, default `[]`)
- `coreqs`: `list[tuple[str, int]]` (optional, default `[]`)

### Conditional rule
- If parser reports `elective_credits_needed > 0` for major electives, then `ui_payload.major_electives` is required.
- `ui_payload.major_electives` must be a `list[CourseIdPayload]`.

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
- 'major_electives': 'list[CourseIdPayload]' (conditionally required; see rule above)

### MeetingPayload
- `day`: `"MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY"`
- `start_time`: `int` (minutes after midnight)
- `end_time`: `int` (minutes after midnight)

## Example parser_payload
```json
{
  "major": "Major": "CSCI",

  "classes_taken": [
    {"subject_area": "CSCI", "catalog_number": 12700}
  ],
  "requirements_needed": [
    {
      "name": "CS Core",
      "attribute": "CS Major Core",
      "fulfilled_by": [],
      "elective_credits_needed": 12
    }
  ]
}

## Example parser_payload
```json
{
  "emplid": 23942520,
  "credit_lower_bound": 12.0,
  "credit_upper_bound": 16.0,
  "unavailable": [
    { "day": "MONDAY", "start_time": 720, "end_time": 810 }
  ],
  "morning": true,
  "afternoon": false,
  "evening": false,
  "less_gaps": true,
  "less_days": true,
  "in_person": true,
  "remote": false,
  "major_electives": [
    { "subject_area": "CSCI", "catalog_number": 35000 },
    { "subject_area": "CSCI", "catalog_number": 35300 }
  ]
}

