# POST /api/schedule/generate Request Body

Use `schedulingLogic/examples/generate_schedule_request.json` as the current UI/parser integration sample. It mirrors the `LANGUAGE_SYMBOLIC_PARSER_PAYLOAD` and `LANGUAGE_SYMBOLIC_UI_PAYLOAD` fixtures in `schedulingLogic/test_profiles.py`.

## Top-level shape

```json
{
  "parser_payload": {},
  "ui_payload": {},
  "term_season": "FALL",
  "term_year": 2026
}
```

## `parser_payload`

Parser-owned academic audit data.

- `majors`: list of scheduler-supported major strings, for example `["CS"]`.
- `classes_taken`: list of completed course IDs.
- `requirements_needed`: list of remaining requirements. Each requirement has `name`, `attribute`, `credits_needed`, and `fulfilled_by`.
- `fulfilled_by`: list of course IDs that can satisfy the requirement.

Course IDs use this shape:

```json
{
  "subject_area": "CSCI",
  "catalog_number": 33500
}
```

## `ui_payload`

UI-owned user preferences and constraints.

- `emplid`: required integer student ID.
- `credit_lower_bound` and `credit_upper_bound`: target credit range.
- `unavailable`: hard blocked meeting windows.
- `morning`, `afternoon`, `evening`: preferred time-of-day flags.
- `less_gaps`, `less_days`: schedule-shaping preferences.
- `in_person`, `remote`: modality preferences.
- `major_electives_needed`, `general_electives_needed`, `specific_courses`: course ID lists selected by the user.
- `departmental`: department names selected by the user.

Meeting windows use minutes after midnight:

```json
{
  "day": "MONDAY",
  "start_time": 720,
  "end_time": 810
}
```

## Term fields

- `term_season`: season passed to candidate section lookup, for example `"FALL"`.
- `term_year`: four-digit year passed to candidate section lookup, for example `2026`.

## Integration notes

- Submit the full JSON object as the request body for `POST /api/schedule/generate`.
- `parser_payload` and `ui_payload` are passed to `build_student_profile(parser_payload, ui_payload)`.
- Course details are not required inside request course IDs; candidate section loading resolves full course/section data from the database.
- The API response contains `score`, `credits`, and UI-renderable `sections`.
