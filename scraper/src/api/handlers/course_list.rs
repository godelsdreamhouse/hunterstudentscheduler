use axum::extract::State;

use crate::{api::AppState, fetcher::fetch_course_list};

#[derive(serde::Deserialize)]
pub struct Pagination {
    skip: u32,
    limit: u32,
}

// E.g., `/v1/course_list?skip=0&limit=20`
pub async fn course_list(
    State(state): State<AppState>,
    pagination: axum::extract::Query<Pagination>,
) -> Result<axum::Json<serde_json::Value>, axum::http::StatusCode> {
    fetch_course_list(
        &state.client,
        &pagination.skip.to_string(),
        &pagination.limit.to_string(),
    )
    .await
    .map(axum::Json)
    .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)
}
