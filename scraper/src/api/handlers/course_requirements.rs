use crate::fetcher::fetch_course_requirements;

pub async fn course_requirements(
    course_group_id: axum::extract::Path<u32>,
) -> Result<axum::Json<serde_json::Value>, axum::http::StatusCode> {
    fetch_course_requirements(&course_group_id.to_string())
        .await
        .map(axum::Json)
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)
}
