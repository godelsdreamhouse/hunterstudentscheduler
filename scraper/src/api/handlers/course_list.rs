use axum::extract::State;
use sqlx::types::time;

use crate::{api::AppState, fetcher::fetch_course_list};

#[derive(serde::Deserialize)]
pub struct Pagination {
    pub skip: u32,
    pub limit: u32,
}

/// Handles the `/course_list?skip=:skip&limit=:limit` route
/// E.g., `/course_list?skip=0&limit=20`
pub async fn course_list_handle(
    State(state): State<AppState>,
    pagination: axum::extract::Query<Pagination>,
) -> Result<axum::Json<Vec<(String, Option<String>)>>, axum::http::StatusCode> {
    let results = fetch_course_list(
        &state.client,
        &state.outbound_limiter,
        &pagination.skip.to_string(),
        &pagination.limit.to_string(),
    )
    .await
    .map(axum::Json)
    .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut course_ids = vec![];

    if let Some(courses) = results.get("data").and_then(|data| data.as_array()) {
        for course in courses {
            let course_id = course
                .get("courseGroupId")
                .and_then(|id| id.as_str())
                .unwrap_or_default();
            let course_code = course
                .get("code")
                .and_then(|code| code.as_str())
                .unwrap_or_default();
            let course_name = course
                .get("longName")
                .and_then(|title| title.as_str())
                .unwrap_or_default();
            let credits = course
                .get("credits")
                .and_then(|credits| credits.get("creditHours"))
                .and_then(|credit_hours| credit_hours.get("min"))
                .and_then(serde_json::Value::as_f64)
                .unwrap_or_default();
            let course_description = course
                .get("description")
                .and_then(|description| description.as_str())
                .unwrap_or_default();
            let is_active = matches!(
                course.get("status").and_then(|status| status.as_str()),
                Some("Active")
            );

            let dep_code = course_code.split(' ').next();
            let dep_name = course
                .get("departments")
                .and_then(|departments| departments.as_array())
                .and_then(|department_array| department_array.iter().next())
                .and_then(|department| department.get("displayName"))
                .and_then(|name| name.as_str())
                .unwrap_or_default();

            sqlx::query!(
                "
                INSERT INTO departments (dep_code, dep_name)
                VALUES ($1, $2)
                ON CONFLICT (dep_code) DO NOTHING
                ",
                dep_code,
                dep_name
            )
            .execute(&state.pool)
            .await
            .map_err(|error| {
                eprintln!("{error}");
                axum::http::StatusCode::INTERNAL_SERVER_ERROR
            })?;

            sqlx::query!(
                "INSERT INTO courses (course_id, course_code, course_name, dep_code, course_description, credits, is_active, last_updated)
                VALUES ($1, $2, $3, $4, $5, $6::float8, $7, $8)
                ON CONFLICT (course_id) DO UPDATE SET
                course_name = EXCLUDED.course_name,
                course_description = EXCLUDED.course_description,
                credits = EXCLUDED.credits,
                is_active = EXCLUDED.is_active
                ",
                course_id,
                course_code,
                course_name,
                dep_code,
                course_description,
                credits,
                is_active,
                time::OffsetDateTime::now_utc().date()
            )
            .execute(&state.pool)
            .await
            .map_err(|error| {
                eprintln!("{error}");
                axum::http::StatusCode::INTERNAL_SERVER_ERROR
            })?;

            let requirement_id = course
                .get("requirementGroup")
                .and_then(|requirement_id| requirement_id.as_str())
                .filter(|requirement_id_string| !requirement_id_string.is_empty());

            match requirement_id {
                Some(requirement_id) => {
                    course_ids.push((course_id.to_string(), Some(requirement_id.to_string())));
                }
                None => course_ids.push((course_id.to_string(), None)),
            }
        }
    }

    Ok(axum::Json(course_ids))
}
