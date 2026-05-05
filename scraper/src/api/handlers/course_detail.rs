use axum::extract::State;

use crate::{api::AppState, fetcher::fetch_course_detail};

/// Handles the `/course_detail/:id` route
pub async fn course_detail_handle(
    State(state): State<AppState>,
    course_group_id: axum::extract::Path<u32>,
) -> Result<axum::Json<serde_json::Value>, axum::http::StatusCode> {
    let results = fetch_course_detail(
        &state.client,
        &state.outbound_limiter,
        &course_group_id.to_string(),
    )
    .await
    .map(axum::Json)
    .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;

    if let Some(courses) = results.get("data").and_then(|data| data.as_array()) {
        for course in courses {
            let raw_department_string = course
                .get("college")
                .and_then(|college| college.as_str())
                .unwrap_or_default();
            let mut split_department_string = raw_department_string.split(" - ");
            let dep_code = split_department_string.next();
            let dep_name = split_department_string.next();

            sqlx::query!(
                "
                INSERT INTO departments (dep_code, dep_name)
                VALUES ($1, $2)
                ON CONFLICT (dep_code) DO UPDATE SET
                dep_name = $2
                ",
                dep_code,
                dep_name
            )
            .execute(&state.pool)
            .await
            .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
        }
    }

    // if let Some(courses) = results.get("data").and_then(|data| data.as_array()) {
    //     for course in courses {
    //         let course_id = course
    //             .get("code")
    //             .and_then(|id| id.as_str())
    //             .unwrap_or_default();
    //         let dep_code = course
    //             .get("subjectCode")
    //             .and_then(|code| code.as_str())
    //             .unwrap_or_default();
    //         let title = course
    //             .get("longName")
    //             .and_then(|title| title.as_str())
    //             .unwrap_or_default();
    //         let credits = course
    //             .get("credits")
    //             .and_then(|credits| credits.get("creditHours"))
    //             .and_then(|credit_hours| credit_hours.get("min"))
    //             .and_then(serde_json::Value::as_f64)
    //             .unwrap_or_default();
    //
    //         sqlx::query!(
    //             "
    //             INSERT INTO departments (dep_code, dep_name)
    //             VALUES ($1, '')
    //             ",
    //             dep_code
    //         )
    //         .execute(&state.pool)
    //         .await
    //         .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    //
    //         sqlx::query!(
    //             "INSERT INTO courses (course_id, dep_code, title, credits)
    //             VALUES ($1, $2, $3, $4::float8)
    //             ON CONFLICT (course_id) DO UPDATE SET
    //             dep_code = EXCLUDED.dep_code,
    //             title = EXCLUDED.title,
    //             credits = EXCLUDED.credits
    //             ",
    //             course_id,
    //             dep_code,
    //             title,
    //             credits
    //         )
    //         .execute(&state.pool)
    //         .await
    //         .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    //     }
    // }

    Ok(results)
}
