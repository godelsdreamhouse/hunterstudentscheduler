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

    let course_ids = scrape_and_upsert(&state, &results).await?;

    Ok(course_ids)
}

struct Parameters<'a> {
    state: &'a AppState,
    course_id: &'a str,
    course_code: &'a str,
    course_name: &'a str,
    dep_code: Option<&'a str>,
    dep_name: &'a str,
    credits: f64,
    course_description: &'a str,
    is_active: bool,
    catalog_attributes: Vec<String>,
    requirement_designation: &'a str,
}

async fn scrape_and_upsert(
    state: &AppState,
    results: &axum::Json<serde_json::Value>,
) -> Result<axum::Json<Vec<(String, Option<String>)>>, axum::http::StatusCode> {
    let mut course_ids = Vec::new();

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
            let custom_fields = course.get("customFields");
            let catalog_attributes = custom_fields
                .and_then(|custom_fields| custom_fields.get("catalogAttributes"))
                .and_then(|catalog_attributes| catalog_attributes.as_array())
                .map(|catalog_attributes| {
                    catalog_attributes
                        .iter()
                        .filter_map(|attribute| {
                            attribute.as_str().map(std::string::ToString::to_string)
                        })
                        .collect::<Vec<String>>()
                })
                .unwrap_or_default();
            let requirement_designation = custom_fields
                .and_then(|custom_fields| custom_fields.get("catalogRequirementDesignation"))
                .and_then(|requirement_designation| requirement_designation.as_str())
                .unwrap_or("NULL");

            let fields = Parameters {
                state,
                course_id,
                course_code,
                course_name,
                dep_code,
                dep_name,
                credits,
                course_description,
                is_active,
                catalog_attributes,
                requirement_designation,
            };

            insert_department(&fields).await?;
            insert_course(&fields).await?;

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

async fn insert_department(fields: &Parameters<'_>) -> Result<(), axum::http::StatusCode> {
    sqlx::query!(
        "
        INSERT INTO departments (dep_code, dep_name)
        VALUES ($1, $2)
        ON CONFLICT (dep_code) DO NOTHING
        ",
        fields.dep_code,
        fields.dep_name
    )
    .execute(&fields.state.pool)
    .await
    .map_err(|error| {
        eprintln!("{error}");
        axum::http::StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(())
}

async fn insert_course(fields: &Parameters<'_>) -> Result<(), axum::http::StatusCode> {
    sqlx::query!(
        "INSERT INTO courses (course_id, course_code, course_name, dep_code, course_description, credits, is_active, last_updated, catalog_attributes, requirement_designation)
        VALUES ($1, $2, $3, $4, $5, $6::float8, $7, $8, $9, $10)
        ON CONFLICT (course_id) DO UPDATE SET
        course_name = EXCLUDED.course_name,
        course_description = EXCLUDED.course_description,
        credits = EXCLUDED.credits,
        is_active = EXCLUDED.is_active,
        last_updated = EXCLUDED.last_updated,
        catalog_attributes = EXCLUDED.catalog_attributes,
        requirement_designation = EXCLUDED.requirement_designation
        ",
        fields.course_id,
        fields.course_code,
        fields.course_name,
        fields.dep_code,
        fields.course_description,
        fields.credits,
        fields.is_active,
        time::OffsetDateTime::now_utc().date(),
        &fields.catalog_attributes,
        fields.requirement_designation
    )
    .execute(&fields.state.pool)
    .await
    .map_err(|error| {
        eprintln!("{error}");
        axum::http::StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(())
}
