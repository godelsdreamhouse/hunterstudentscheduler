use crate::fetcher::fetch_course_section;

#[derive(serde::Deserialize)]
pub struct Section {
    course_group_id: u32,
    term_id: u32,
}

pub async fn course_section(
    section: axum::extract::Query<Section>,
) -> Result<axum::Json<serde_json::Value>, axum::http::StatusCode> {
    fetch_course_section(
        &section.course_group_id.to_string(),
        &section.term_id.to_string(),
    )
    .await
    .map(axum::Json)
    .map_err(|_| axum::http::StatusCode::INTERNAL_SERVER_ERROR)
}
