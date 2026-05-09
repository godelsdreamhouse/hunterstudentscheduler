use axum::extract::State;

use crate::{api::AppState, fetcher::fetch_course_requirements};

#[derive(serde::Deserialize)]
pub struct Ids {
    pub requirement_id: String,
    pub course_group_id: String,
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

        sqlx::query!(
            "
                UPDATE courses SET
                prerequisites_notes = $1
                WHERE course_id = $2
                ",
            prerequisites_notes,
            &ids.course_group_id
        )
        .execute(&state.pool)
        .await
        .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    Ok(results)
}
