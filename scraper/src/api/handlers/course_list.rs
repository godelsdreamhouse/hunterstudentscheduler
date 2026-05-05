use axum::extract::State;

use crate::{api::AppState, fetcher::fetch_course_list};

#[derive(serde::Deserialize)]
pub struct Pagination {
    skip: u32,
    limit: u32,
}

/// Handles the `/course_list?skip=:skip&limit=:limit` route
/// E.g., `/course_list?skip=0&limit=20`
pub async fn course_list_handle(
    State(state): State<AppState>,
    pagination: axum::extract::Query<Pagination>,
) -> Result<axum::Json<serde_json::Value>, axum::http::StatusCode> {
    let results = fetch_course_list(
        &state.client,
        &state.outbound_limiter,
        &pagination.skip.to_string(),
        &pagination.limit.to_string(),
    )
    .await
    .map(axum::Json)
    .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    if let Some(courses) = results.get("data").and_then(|data| data.as_array()) {
        for course in courses {
            let course_id = course
                .get("code")
                .and_then(|id| id.as_str())
                .unwrap_or_default();
            let dep_code = course
                .get("subjectCode")
                .and_then(|code| code.as_str())
                .unwrap_or_default();
            let title = course
                .get("longName")
                .and_then(|title| title.as_str())
                .unwrap_or_default();
            let credits = course
                .get("credits")
                .and_then(|credits| credits.get("creditHours"))
                .and_then(|credit_hours| credit_hours.get("min"))
                .and_then(serde_json::Value::as_f64)
                .unwrap_or_default();

            sqlx::query!(
                "
                INSERT INTO departments (dep_code, dep_name)
                VALUES ($1, '')
                ",
                dep_code
            )
            .execute(&state.pool)
            .await
            .map_err(|error| {
                eprintln!("{error}");
                axum::http::StatusCode::INTERNAL_SERVER_ERROR
            })?;

            sqlx::query!(
                "INSERT INTO courses (course_id, dep_code, title, credits)
                VALUES ($1, $2, $3, $4::float8)
                ON CONFLICT (course_id) DO UPDATE SET
                dep_code = EXCLUDED.dep_code,
                title = EXCLUDED.title,
                credits = EXCLUDED.credits
                ",
                course_id,
                dep_code,
                title,
                credits
            )
            .execute(&state.pool)
            .await
            .map_err(|error| {
                eprintln!("{error}");
                axum::http::StatusCode::INTERNAL_SERVER_ERROR
            })?;
        }
    }

    Ok(results)
}
