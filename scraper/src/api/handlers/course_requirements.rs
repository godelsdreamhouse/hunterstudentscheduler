use std::sync::OnceLock;

use axum::extract::State;
use regex::Regex;

use crate::{api::AppState, fetcher::fetch_course_requirements};

#[derive(serde::Deserialize)]
pub struct Ids {
    pub requirement_id: String,
    pub course_group_id: String,
}

// Common English words that match the dept-code shape but are never course depts.
const NOT_DEPT: &[&str] = &[
    "OR", "AND", "NOT", "TO", "OF", "AT", "IN", "ON", "BY", "AN", "NO", "WITH", "FOR", "FROM",
    "ONLY", "OPEN", "ALL", "ANY", "ONE", "TWO", "THE", "BOTH", "EACH", "PRE", "CO", "NON",
];

fn explicit_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"\b([A-Za-z]{2,7})\s+(\d{3,6}[A-Za-z0-9]{0,3})\b")
            .expect("explicit course-code regex is valid")
    })
}

fn bare_re() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| {
        Regex::new(r"(?:[,/]|\bor\b|\band\b)\s*(\d{3,6}[A-Za-z0-9]{0,3})\b")
            .expect("bare course-number regex is valid")
    })
}

pub fn parse_prerequisites(notes: &str) -> Vec<String> {
    enum MatchKind {
        Explicit { dept: String, num: String },
        Bare { num: String },
    }

    let mut events: Vec<(usize, usize, MatchKind)> = Vec::new();

    for cap in explicit_re().captures_iter(notes) {
        let dept = cap[1].to_uppercase();
        if NOT_DEPT.contains(&dept.as_str()) {
            continue;
        }
        let m = cap.get(0).expect("full match always present");
        events.push((
            m.start(),
            m.end(),
            MatchKind::Explicit {
                dept,
                num: cap[2].to_uppercase(),
            },
        ));
    }

    for cap in bare_re().captures_iter(notes) {
        let m = cap.get(0).expect("full match always present");
        events.push((
            m.start(),
            m.end(),
            MatchKind::Bare {
                num: cap[1].to_uppercase(),
            },
        ));
    }

    events.sort_by_key(|(start, _, _)| *start);

    let mut seen = std::collections::HashSet::new();
    let mut prereqs: Vec<String> = Vec::new();
    let mut current_dept: Option<String> = None;
    let mut prev_end: usize = 0;

    for (start, end, kind) in events {
        let gap = notes.get(prev_end..start).unwrap_or_default();
        if gap.contains('.') || gap.contains(';') {
            current_dept = None;
        }

        match kind {
            MatchKind::Explicit { dept, num } => {
                let code = format!("{dept} {num}");
                if seen.insert(code.clone()) {
                    prereqs.push(code);
                }
                current_dept = Some(dept);
            }
            MatchKind::Bare { num } => {
                if let Some(ref dept) = current_dept {
                    let code = format!("{dept} {num}");
                    if seen.insert(code.clone()) {
                        prereqs.push(code);
                    }
                }
            }
        }

        prev_end = end;
    }

    prereqs
}
/// Handles the `/course_requirements` route
pub async fn course_requirements_handle(
    State(state): State<AppState>,
    ids: axum::extract::Query<Ids>,
) -> Result<axum::Json<serde_json::Value>, axum::http::StatusCode> {
    let results =
        fetch_course_requirements(&state.client, &state.outbound_limiter, &ids.requirement_id)
            .await
            .map(axum::Json)
            .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    if let Some(requirements) = results
        .get("data")
        .and_then(|requirements| requirements.as_object())
    {
        let prerequisites_notes = requirements
            .get(&ids.requirement_id)
            .and_then(|requirement| requirement.get("descriptionLong"))
            .and_then(|description| description.as_str())
            .unwrap_or_default();

        let prerequisites = parse_prerequisites(prerequisites_notes);

        sqlx::query!(
            "
                UPDATE courses SET
                prerequisites_notes = $1,
                prerequisites = $2
                WHERE course_id = $3
                ",
            prerequisites_notes,
            &prerequisites,
            &ids.course_group_id
        )
        .execute(&state.pool)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    Ok(results)
}
