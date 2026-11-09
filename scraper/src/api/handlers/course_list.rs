use axum::extract::State;
use sqlx::types::time;
use std::collections::HashSet;

use crate::{api::AppState, fetcher::fetch_course_list};

const MAX_MISSING_ATTRIBUTE_FIELDS: usize = 10;
const ALLOWED_ISOLATED_MISSING_ATTRIBUTE_FIELDS: usize = 2;
const MAX_MISSING_ATTRIBUTE_PERCENT: usize = 5;
const MIN_RAW_NONEMPTY_ATTRIBUTE_PERCENT: usize = 70;
const MIN_RETAINED_NONEMPTY_ATTRIBUTE_PERCENT: usize = 20;

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
    course_list_page(State(state), pagination, false).await
}

pub(crate) async fn course_list_page(
    State(state): State<AppState>,
    pagination: axum::extract::Query<Pagination>,
    require_complete_catalog: bool,
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

    scrape_and_upsert(&state, &results, &pagination, require_complete_catalog).await
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
    replace_catalog_attributes: bool,
    requirement_designation: &'a str,
}

async fn scrape_and_upsert(
    state: &AppState,
    results: &axum::Json<serde_json::Value>,
    pagination: &Pagination,
    require_complete_catalog: bool,
) -> Result<axum::Json<Vec<(String, Option<String>)>>, axum::http::StatusCode> {
    let mut course_ids = Vec::new();
    let courses = results
        .get("data")
        .and_then(serde_json::Value::as_array)
        .ok_or_else(|| {
            eprintln!("Coursedog course response data must be an array");
            axum::http::StatusCode::BAD_GATEWAY
        })?;
    let complete_catalog = validate_page_metadata(results, pagination, courses.len())?;
    if require_complete_catalog && !complete_catalog {
        eprintln!("Coursedog did not return the complete course catalog during initialization");
        return Err(axum::http::StatusCode::BAD_GATEWAY);
    }
    if complete_catalog && courses.is_empty() {
        eprintln!("Coursedog returned an empty first page of courses");
        return Err(axum::http::StatusCode::BAD_GATEWAY);
    }

    if !courses.is_empty() {
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
                        parsed
                    })
                    .map_err(|error| {
                        eprintln!("invalid Coursedog attributes for {course_id}: {error}");
                        axum::http::StatusCode::BAD_GATEWAY
                    })
            })
            .collect::<Result<Vec<_>, _>>()?;

        if complete_catalog && attribute_source_drifted(missing_attribute_fields, courses.len()) {
            eprintln!(
                "Coursedog omitted the top-level attributes field for {missing_attribute_fields} of {} courses; refusing to replace catalog attributes",
                courses.len()
            );
            return Err(axum::http::StatusCode::BAD_GATEWAY);
        }
        let raw_nonempty_attributes = courses
            .iter()
            .filter(|course| {
                course
                    .get("attributes")
                    .and_then(serde_json::Value::as_array)
                    .is_some_and(|attributes| !attributes.is_empty())
            })
            .count();
        let retained_nonempty_attributes = catalog_attributes
            .iter()
            .filter(|attributes| !attributes.values.is_empty())
            .count();
        if complete_catalog
            && attribute_population_drifted(
                raw_nonempty_attributes,
                retained_nonempty_attributes,
                courses.len(),
            )
        {
            eprintln!(
                "Coursedog catalog attribute population collapsed: {raw_nonempty_attributes} raw and {retained_nonempty_attributes} retained nonempty records out of {}; refusing to replace stored attributes",
                courses.len()
            );
            return Err(axum::http::StatusCode::BAD_GATEWAY);
        }

        for (course, parsed_attributes) in courses.iter().zip(catalog_attributes) {
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
                catalog_attributes: parsed_attributes.values,
                replace_catalog_attributes: !parsed_attributes.source_field_missing,
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

fn validate_page_metadata(
    results: &axum::Json<serde_json::Value>,
    pagination: &Pagination,
    returned_count: usize,
) -> Result<bool, axum::http::StatusCode> {
    let response_skip = results.get("skip").and_then(serde_json::Value::as_u64);
    let response_limit = results.get("limit").and_then(serde_json::Value::as_u64);
    let list_length = results
        .get("listLength")
        .and_then(serde_json::Value::as_u64);
    let requested_skip = u64::from(pagination.skip);
    let requested_limit = u64::from(pagination.limit);

    let Some((response_skip, response_limit, list_length)) = response_skip
        .zip(response_limit)
        .zip(list_length)
        .map(|((response_skip, response_limit), list_length)| {
            (response_skip, response_limit, list_length)
        })
    else {
        eprintln!("Coursedog course response omitted valid pagination metadata");
        return Err(axum::http::StatusCode::BAD_GATEWAY);
    };

    let expected_count = requested_limit.min(list_length.saturating_sub(requested_skip));
    if response_skip != requested_skip
        || response_limit != requested_limit
        || requested_skip > list_length
        || u64::try_from(returned_count).ok() != Some(expected_count)
    {
        eprintln!(
            "Coursedog course pagination mismatch: requested skip={requested_skip} limit={requested_limit}, received skip={response_skip} limit={response_limit} listLength={list_length} data={returned_count}"
        );
        return Err(axum::http::StatusCode::BAD_GATEWAY);
    }

    Ok(requested_skip == 0 && u64::try_from(returned_count).ok() == Some(list_length))
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

fn attribute_population_drifted(
    raw_nonempty: usize,
    retained_nonempty: usize,
    course_count: usize,
) -> bool {
    course_count > 0
        && (raw_nonempty.saturating_mul(100)
            < course_count.saturating_mul(MIN_RAW_NONEMPTY_ATTRIBUTE_PERCENT)
            || retained_nonempty.saturating_mul(100)
                < course_count.saturating_mul(MIN_RETAINED_NONEMPTY_ATTRIBUTE_PERCENT))
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
    let mut seen = HashSet::with_capacity(attributes.len());
    for attribute in attributes {
        let attribute = attribute
            .as_str()
            .ok_or("top-level attributes must contain only strings")?
            .trim();
        if attribute.is_empty() {
            return Err("top-level attributes must not contain empty strings");
        }
        if !seen.insert(attribute) {
            return Err("top-level attributes must contain unique strings");
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
        VALUES ($1, $2, $3, $4, $5, $6::float8, $7, $8, $9, $11)
        ON CONFLICT (course_id) DO UPDATE SET
        course_name = EXCLUDED.course_name,
        course_description = EXCLUDED.course_description,
        credits = EXCLUDED.credits,
        is_active = EXCLUDED.is_active,
        last_updated = EXCLUDED.last_updated,
        catalog_attributes = CASE
            WHEN $10 THEN EXCLUDED.catalog_attributes
            ELSE courses.catalog_attributes
        END,
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
        fields.replace_catalog_attributes,
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
    use super::*;
    use crate::api::{OutboundLimiterSettings, new_outbound_limiter};

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

        assert!(!attribute_population_drifted(7_662, 2_604, 9_472));
        assert!(attribute_population_drifted(1, 1, 9_472));
        assert!(attribute_population_drifted(6_000, 2_604, 9_472));
        assert!(attribute_population_drifted(7_662, 1_800, 9_472));
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
        assert!(
            parse_catalog_attributes(&serde_json::json!({
                "attributes": ["WRIC - Writing Intensive", "WRIC - Writing Intensive"]
            }))
            .is_err()
        );
    }

    #[test]
    fn validates_pagination_metadata_and_identifies_only_complete_catalogs() {
        let complete = axum::Json(serde_json::json!({
            "skip": 0,
            "limit": 2,
            "listLength": 2
        }));
        let partial = axum::Json(serde_json::json!({
            "skip": 0,
            "limit": 2,
            "listLength": 10
        }));
        let missing = axum::Json(serde_json::json!({}));
        let wrong_skip = axum::Json(serde_json::json!({
            "skip": 1,
            "limit": 2,
            "listLength": 10
        }));

        assert_eq!(
            validate_page_metadata(&complete, &Pagination { skip: 0, limit: 2 }, 2),
            Ok(true)
        );
        assert_eq!(
            validate_page_metadata(&partial, &Pagination { skip: 0, limit: 2 }, 2),
            Ok(false)
        );
        assert!(validate_page_metadata(&missing, &Pagination { skip: 0, limit: 2 }, 2).is_err());
        assert!(validate_page_metadata(&wrong_skip, &Pagination { skip: 0, limit: 2 }, 2).is_err());
        assert!(validate_page_metadata(&partial, &Pagination { skip: 0, limit: 2 }, 1).is_err());
    }

    #[tokio::test]
    async fn rejects_missing_malformed_and_unexpectedly_empty_data() {
        let missing = axum::Json(serde_json::json!({}));
        let malformed = axum::Json(serde_json::json!({ "data": {} }));
        let empty = axum::Json(serde_json::json!({
            "data": [],
            "skip": 0,
            "limit": 99_999,
            "listLength": 0
        }));
        let collapsed_attributes = axum::Json(serde_json::json!({
            "data": [
                {
                    "courseGroupId": "first",
                    "attributes": []
                },
                {
                    "courseGroupId": "second",
                    "attributes": []
                }
            ],
            "skip": 0,
            "limit": 2,
            "listLength": 2
        }));
        let pool =
            sqlx::PgPool::connect_lazy("postgres://unused").expect("syntactically valid test URL");
        let state = AppState {
            pool,
            client: reqwest::Client::new(),
            outbound_limiter: new_outbound_limiter(&OutboundLimiterSettings {
                per_second: 1,
                burst_size: 1,
            }),
        };

        let full_page = Pagination {
            skip: 0,
            limit: 99_999,
        };
        assert!(matches!(
            scrape_and_upsert(&state, &missing, &full_page, false).await,
            Err(axum::http::StatusCode::BAD_GATEWAY)
        ));
        assert!(matches!(
            scrape_and_upsert(&state, &malformed, &full_page, false).await,
            Err(axum::http::StatusCode::BAD_GATEWAY)
        ));
        assert!(matches!(
            scrape_and_upsert(&state, &empty, &full_page, false).await,
            Err(axum::http::StatusCode::BAD_GATEWAY)
        ));
        let two_course_page = Pagination { skip: 0, limit: 2 };
        assert!(matches!(
            scrape_and_upsert(&state, &collapsed_attributes, &two_course_page, false).await,
            Err(axum::http::StatusCode::BAD_GATEWAY)
        ));
        let empty_later = axum::Json(serde_json::json!({
            "data": [],
            "skip": 2,
            "limit": 2,
            "listLength": 2
        }));
        let later_page = scrape_and_upsert(
            &state,
            &empty_later,
            &Pagination { skip: 2, limit: 2 },
            false,
        )
        .await
        .expect("an empty later page terminates pagination");
        assert!(later_page.0.is_empty());
    }

    #[sqlx::test(migrations = false)]
    async fn omitted_attributes_preserve_existing_database_values(pool: sqlx::PgPool) {
        sqlx::raw_sql(include_str!("../../../../database/schema.sql"))
            .execute(&pool)
            .await
            .expect("test schema");
        sqlx::raw_sql(
            "INSERT INTO departments (dep_code, dep_name) VALUES ('TEST', 'Test');
             INSERT INTO courses (course_id, course_code, course_name, dep_code, catalog_attributes)
             VALUES ('existing', 'TEST 101', 'Existing', 'TEST', ARRAY['PLDI', 'WRIC'])",
        )
        .execute(&pool)
        .await
        .expect("seed course");
        let state = AppState {
            pool: pool.clone(),
            client: reqwest::Client::new(),
            outbound_limiter: new_outbound_limiter(&OutboundLimiterSettings {
                per_second: 1,
                burst_size: 1,
            }),
        };
        let response = axum::Json(serde_json::json!({
            "data": [
                {
                    "courseGroupId": "existing",
                    "code": "TEST 101",
                    "longName": "Existing updated",
                    "departments": [{"displayName": "Test"}],
                    "status": "Active"
                },
                {
                    "courseGroupId": "new",
                    "code": "TEST 102",
                    "longName": "New",
                    "departments": [{"displayName": "Test"}],
                    "status": "Active",
                    "attributes": ["WRIC"]
                }
            ],
            "skip": 0,
            "limit": 2,
            "listLength": 10
        }));

        let _ = scrape_and_upsert(&state, &response, &Pagination { skip: 0, limit: 2 }, false)
            .await
            .expect("tolerated omission");

        let isolated_omission = axum::Json(serde_json::json!({
            "data": [
                {
                    "courseGroupId": "existing",
                    "code": "TEST 101",
                    "longName": "Existing after isolated omission",
                    "departments": [{"displayName": "Test"}],
                    "status": "Active"
                }
            ],
            "skip": 664,
            "limit": 1,
            "listLength": 9_472
        }));
        let _ = scrape_and_upsert(
            &state,
            &isolated_omission,
            &Pagination {
                skip: 664,
                limit: 1,
            },
            false,
        )
        .await
        .expect("an isolated omission on a partial page is preserved");

        let existing: (String, Vec<String>) = sqlx::query_as(
            "SELECT course_name, catalog_attributes FROM courses WHERE course_id = 'existing'",
        )
        .fetch_one(&pool)
        .await
        .expect("existing attributes");
        let new: Vec<String> =
            sqlx::query_scalar("SELECT catalog_attributes FROM courses WHERE course_id = 'new'")
                .fetch_one(&pool)
                .await
                .expect("new attributes");
        assert_eq!(existing.0, "Existing after isolated omission");
        assert_eq!(existing.1, vec!["PLDI", "WRIC"]);
        assert_eq!(new, vec!["WRIC"]);
    }

    #[sqlx::test(migrations = false)]
    async fn broad_partial_attribute_collapse_makes_no_database_changes(pool: sqlx::PgPool) {
        sqlx::raw_sql(include_str!("../../../../database/schema.sql"))
            .execute(&pool)
            .await
            .expect("test schema");
        sqlx::raw_sql(
            "INSERT INTO departments (dep_code, dep_name) VALUES ('TEST', 'Test');
             INSERT INTO courses (course_id, course_code, course_name, dep_code, catalog_attributes)
             VALUES
               ('course-0', 'TEST 100', 'Original zero', 'TEST', ARRAY['PLDI']),
               ('course-1', 'TEST 101', 'Original one', 'TEST', ARRAY['WRIC'])",
        )
        .execute(&pool)
        .await
        .expect("seed courses");
        let state = AppState {
            pool: pool.clone(),
            client: reqwest::Client::new(),
            outbound_limiter: new_outbound_limiter(&OutboundLimiterSettings {
                per_second: 1,
                burst_size: 1,
            }),
        };
        let data = (0..10)
            .map(|index| {
                serde_json::json!({
                    "courseGroupId": format!("course-{index}"),
                    "code": format!("TEST {}", 100 + index),
                    "longName": format!("Changed {index}"),
                    "departments": [{"displayName": "Test"}],
                    "status": "Active",
                    "attributes": if index == 0 {
                        serde_json::json!(["PLDI"])
                    } else {
                        serde_json::json!([])
                    }
                })
            })
            .collect::<Vec<_>>();
        let response = axum::Json(serde_json::json!({
            "data": data,
            "skip": 0,
            "limit": 10,
            "listLength": 10
        }));

        assert!(matches!(
            scrape_and_upsert(&state, &response, &Pagination { skip: 0, limit: 10 }, false,).await,
            Err(axum::http::StatusCode::BAD_GATEWAY)
        ));

        let rows: Vec<(String, String, Vec<String>)> = sqlx::query_as(
            "SELECT course_id, course_name, catalog_attributes
             FROM courses
             ORDER BY course_id",
        )
        .fetch_all(&pool)
        .await
        .expect("unchanged courses");
        assert_eq!(
            rows,
            vec![
                (
                    "course-0".to_string(),
                    "Original zero".to_string(),
                    vec!["PLDI".to_string()],
                ),
                (
                    "course-1".to_string(),
                    "Original one".to_string(),
                    vec!["WRIC".to_string()],
                ),
            ]
        );
    }

    #[sqlx::test(migrations = false)]
    async fn incomplete_required_catalog_makes_no_database_changes(pool: sqlx::PgPool) {
        sqlx::raw_sql(include_str!("../../../../database/schema.sql"))
            .execute(&pool)
            .await
            .expect("test schema");
        sqlx::raw_sql(
            "INSERT INTO departments (dep_code, dep_name) VALUES ('TEST', 'Test');
             INSERT INTO courses (course_id, course_code, course_name, dep_code, catalog_attributes)
             VALUES
               ('first', 'TEST 101', 'Original first', 'TEST', ARRAY['PLDI']),
               ('second', 'TEST 102', 'Original second', 'TEST', ARRAY['WRIC'])",
        )
        .execute(&pool)
        .await
        .expect("seed courses");
        let state = AppState {
            pool: pool.clone(),
            client: reqwest::Client::new(),
            outbound_limiter: new_outbound_limiter(&OutboundLimiterSettings {
                per_second: 1,
                burst_size: 1,
            }),
        };
        let response = axum::Json(serde_json::json!({
            "data": [
                {
                    "courseGroupId": "first",
                    "code": "TEST 101",
                    "longName": "Changed first",
                    "departments": [{"displayName": "Test"}],
                    "status": "Active",
                    "attributes": []
                },
                {
                    "courseGroupId": "second",
                    "code": "TEST 102",
                    "longName": "Changed second",
                    "departments": [{"displayName": "Test"}],
                    "status": "Active",
                    "attributes": []
                }
            ],
            "skip": 0,
            "limit": 2,
            "listLength": 3
        }));

        assert!(matches!(
            scrape_and_upsert(&state, &response, &Pagination { skip: 0, limit: 2 }, true,).await,
            Err(axum::http::StatusCode::BAD_GATEWAY)
        ));

        let rows: Vec<(String, String, Vec<String>)> = sqlx::query_as(
            "SELECT course_id, course_name, catalog_attributes
             FROM courses
             ORDER BY course_id",
        )
        .fetch_all(&pool)
        .await
        .expect("unchanged courses");
        assert_eq!(
            rows,
            vec![
                (
                    "first".to_string(),
                    "Original first".to_string(),
                    vec!["PLDI".to_string()],
                ),
                (
                    "second".to_string(),
                    "Original second".to_string(),
                    vec!["WRIC".to_string()],
                ),
            ]
        );
    }
}
