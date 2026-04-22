use crate::fetcher::fetch_all_terms;

pub async fn all_terms() -> Result<axum::Json<serde_json::Value>, axum::http::StatusCode> {
    fetch_all_terms()
        .await
        .map(axum::Json)
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)
}
