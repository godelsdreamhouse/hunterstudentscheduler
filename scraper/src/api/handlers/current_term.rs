use crate::fetcher::fetch_current_term;

pub async fn current_term() -> Result<axum::Json<serde_json::Value>, axum::http::StatusCode> {
    fetch_current_term()
        .await
        .map(axum::Json)
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)
}
