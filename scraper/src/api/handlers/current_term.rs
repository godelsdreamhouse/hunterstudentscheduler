use axum::extract::State;

use crate::{api::AppState, fetcher::fetch_current_term};

/// Handles the `/current_term` route
pub async fn current_term(
    State(state): State<AppState>,
) -> Result<axum::Json<serde_json::Value>, axum::http::StatusCode> {
    fetch_current_term(&state.client, &state.outbound_limiter)
        .await
        .map(axum::Json)
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)
}
