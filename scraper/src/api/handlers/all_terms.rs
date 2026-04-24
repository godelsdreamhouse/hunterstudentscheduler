use crate::{api::AppState, fetcher::fetch_all_terms};

pub async fn all_terms(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> Result<axum::Json<serde_json::Value>, axum::http::StatusCode> {
    fetch_all_terms(&state.client, &state.outbound_limiter)
        .await
        .map(axum::Json)
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)
}
