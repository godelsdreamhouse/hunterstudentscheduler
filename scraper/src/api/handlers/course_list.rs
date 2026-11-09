use axum::extract::State;
use sqlx::types::time;

use crate::{api::AppState, fetcher::fetch_course_list};

const MAX_MISSING_ATTRIBUTE_FIELDS: usize = 10;
const ALLOWED_ISOLATED_MISSING_ATTRIBUTE_FIELDS: usize = 2;
const MAX_MISSING_ATTRIBUTE_PERCENT: usize = 5;

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
        let mut missing_attribute_fields = 0;
        let catalog_attributes = courses
            .iter()
            .map(|course| {
                let course_id = course
                    .get("courseGroupId")
                    .and_then(serde_json::Value::as_str)
                    .unwrap_or("unknown course");
                parse_catalog_attributes(course)
                    .map(|parsed| {
                        if parsed.source_field_missing {
                            missing_attribute_fields += 1;
                            eprintln!(
                                "Coursedog course {course_id} omitted the top-level attributes field"
                            );
                        }
                        parsed.values
                    })
                    .map_err(|error| {
                        eprintln!("invalid Coursedog attributes for {course_id}: {error}");
                        axum::http::StatusCode::BAD_GATEWAY
                    })
            })
            .collect::<Result<Vec<_>, _>>()?;

        if attribute_source_drifted(missing_attribute_fields, courses.len()) {
            eprintln!(
                "Coursedog omitted the top-level attributes field for {missing_attribute_fields} of {} courses; refusing to replace catalog attributes",
                courses.len()
            );
            return Err(axum::http::StatusCode::BAD_GATEWAY);
        }

        for (course, catalog_attributes) in courses.iter().zip(catalog_attributes) {
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

fn attribute_source_drifted(missing_fields: usize, course_count: usize) -> bool {
    if course_count == 0 || missing_fields == 0 {
        return false;
    }

    missing_fields > MAX_MISSING_ATTRIBUTE_FIELDS
        || missing_fields == course_count
        || (missing_fields > ALLOWED_ISOLATED_MISSING_ATTRIBUTE_FIELDS
            && missing_fields.saturating_mul(100)
                > course_count.saturating_mul(MAX_MISSING_ATTRIBUTE_PERCENT))
}

#[derive(Debug, PartialEq)]
struct ParsedCatalogAttributes {
    values: Vec<String>,
    source_field_missing: bool,
}

fn parse_catalog_attributes(
    course: &serde_json::Value,
) -> Result<ParsedCatalogAttributes, &'static str> {
    let Some(attributes) = course.get("attributes") else {
        return Ok(ParsedCatalogAttributes {
            values: Vec::new(),
            source_field_missing: true,
        });
    };
    let attributes = attributes
        .as_array()
        .ok_or("top-level attributes must be an array")?;
    let mut values = Vec::with_capacity(attributes.len());
    for attribute in attributes {
        let attribute = attribute
            .as_str()
            .ok_or("top-level attributes must contain only strings")?
            .trim();
        if attribute.is_empty() {
            return Err("top-level attributes must not contain empty strings");
        }
        if !attribute
            .split_whitespace()
            .next()
            .is_some_and(|code| code.eq_ignore_ascii_case("COPT"))
        {
            values.push(attribute.to_string());
        }
    }

    Ok(ParsedCatalogAttributes {
        values,
        source_field_missing: false,
    })
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

#[cfg(test)]
mod structured_attribute_tests {
    use super::{ParsedCatalogAttributes, attribute_source_drifted, parse_catalog_attributes};

    #[test]
    fn rejects_absolute_proportional_and_all_record_source_drift() {
        assert!(!attribute_source_drifted(0, 0));
        assert!(!attribute_source_drifted(0, 10));
        assert!(!attribute_source_drifted(2, 9_472));
        assert!(!attribute_source_drifted(2, 10));
        assert!(!attribute_source_drifted(5, 100));

        assert!(attribute_source_drifted(1, 1));
        assert!(attribute_source_drifted(2, 2));
        assert!(attribute_source_drifted(3, 20));
        assert!(attribute_source_drifted(6, 100));
        assert!(attribute_source_drifted(11, 1_000));
    }

    #[test]
    fn uses_mapped_attributes_and_filters_only_college_option() {
        let course = serde_json::json!({
            "attributes": [
                "copt - COPT (College Option)",
                "PLDI - GROUPC (Group C)",
                "WRIC - WRIC (Writing Intensive)"
            ],
            "customFields": {
                "catalogAttributes": ["WRIC - WRIC (Writing Intensive)"]
            }
        });
        assert_eq!(
            parse_catalog_attributes(&course),
            Ok(ParsedCatalogAttributes {
                values: vec![
                    "PLDI - GROUPC (Group C)".to_string(),
                    "WRIC - WRIC (Writing Intensive)".to_string(),
                ],
                source_field_missing: false,
            })
        );
    }

    #[test]
    fn accepts_an_explicitly_empty_attribute_array() {
        assert_eq!(
            parse_catalog_attributes(&serde_json::json!({ "attributes": [] })),
            Ok(ParsedCatalogAttributes {
                values: Vec::new(),
                source_field_missing: false,
            })
        );
    }

    #[test]
    fn identifies_an_omitted_attribute_field() {
        assert_eq!(
            parse_catalog_attributes(&serde_json::json!({
                "customFields": { "catalogAttributes": ["WRIC"] }
            })),
            Ok(ParsedCatalogAttributes {
                values: Vec::new(),
                source_field_missing: true,
            })
        );
    }

    #[test]
    fn rejects_malformed_attribute_shapes() {
        assert!(parse_catalog_attributes(&serde_json::json!({ "attributes": null })).is_err());
        assert!(
            parse_catalog_attributes(&serde_json::json!({ "attributes": ["WRIC", 7] })).is_err()
        );
        assert!(parse_catalog_attributes(&serde_json::json!({ "attributes": [""] })).is_err());
    }
}
