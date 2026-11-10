use axum::extract::State;
use tokio::task::JoinSet;

use crate::api::{
    AppState,
    handlers::{
        all_terms::all_terms_handle,
        course_list::{Pagination, course_list_handle, enrich_published_attributes},
        course_requirements::{Ids, course_requirements_handle},
        course_section::{Section, course_section_handle},
    },
};

const MAX_CONCURRENT_REQUESTS: usize = 20;
const DEFAULT_TERM_LIMIT: usize = 3;

/// Handles the `/initialize` route
pub async fn initialize_handle(
    State(state): State<AppState>,
) -> Result<(), axum::http::StatusCode> {
    initialize_for_terms(state, None).await
}

/// Scrapes the default rolling terms, or an explicit set when invoked by the
/// command-line scraper for a catalog release.
pub async fn initialize_for_terms(
    state: AppState,
    requested_term_ids: Option<&[String]>,
) -> Result<(), axum::http::StatusCode> {
    let ids = course_list_handle(
        State(state.clone()),
        axum::extract::Query(Pagination {
            skip: 0,
            limit: 99999,
        }),
    )
    .await
    .map_err(|error| {
        eprintln!("{error}");
        axum::http::StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let default_term_ids;
    let term_ids = if let Some(term_ids) = requested_term_ids {
        term_ids
    } else {
        let terms = all_terms_handle(State(state.clone())).await?;
        default_term_ids =
            select_default_term_ids(&terms.0, &chrono::Local::now().date_naive().to_string())?;
        &default_term_ids
    };

    let mut section_tasks = JoinSet::new();
    for id in &ids.0 {
        for term_id in term_ids {
            while section_tasks.len() >= MAX_CONCURRENT_REQUESTS {
                join_next(&mut section_tasks).await?;
            }
            let state = state.clone();
            let course_group_id = id.0.clone();
            let term_id = term_id.clone();
            section_tasks.spawn(async move {
                course_section_handle(
                    State(state),
                    axum::extract::Query(Section {
                        course_group_id,
                        term_id,
                    }),
                )
                .await
                .map(|_| ())
            });
        }
    }
    while !section_tasks.is_empty() {
        join_next(&mut section_tasks).await?;
    }

    // The public catalog applies mapped attributes that are absent from the
    // course-management search feed. Enrich only courses represented by
    // scraped sections rather than requesting every historical course page.
    let section_course_ids = sqlx::query_scalar::<_, String>(
        "SELECT DISTINCT course_id FROM sections ORDER BY course_id",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|error| {
        eprintln!("failed to list section courses for attribute enrichment: {error}");
        axum::http::StatusCode::INTERNAL_SERVER_ERROR
    })?;
    let mut attribute_tasks = JoinSet::new();
    for course_group_id in section_course_ids {
        while attribute_tasks.len() >= MAX_CONCURRENT_REQUESTS {
            join_next(&mut attribute_tasks).await?;
        }
        let state = state.clone();
        attribute_tasks.spawn(async move {
            if let Err(error) = enrich_published_attributes(&state, &course_group_id).await {
                eprintln!("attribute enrichment failed for {course_group_id}: {error}");
            }
            Ok(())
        });
    }
    while !attribute_tasks.is_empty() {
        join_next(&mut attribute_tasks).await?;
    }

    let mut requirement_tasks = JoinSet::new();
    for id in ids.0.iter().filter(|id| id.1.is_some()) {
        while requirement_tasks.len() >= MAX_CONCURRENT_REQUESTS {
            join_next(&mut requirement_tasks).await?;
        }
        let state = state.clone();
        let requirement_id = id.1.clone().unwrap_or_default();
        let course_group_id = id.0.clone();
        requirement_tasks.spawn(async move {
            course_requirements_handle(
                State(state),
                axum::extract::Query(Ids {
                    requirement_id,
                    course_group_id,
                }),
            )
            .await
            .map(|_| ())
        });
    }
    while !requirement_tasks.is_empty() {
        join_next(&mut requirement_tasks).await?;
    }

    Ok(())
}

fn select_default_term_ids(
    response: &serde_json::Value,
    today: &str,
) -> Result<Vec<String>, axum::http::StatusCode> {
    let mut terms = response
        .get("terms")
        .and_then(serde_json::Value::as_array)
        .ok_or_else(|| {
            eprintln!("Coursedog terms response did not contain a terms array");
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        })?
        .iter()
        .filter(|term| term.get("public").and_then(serde_json::Value::as_bool) == Some(true))
        .filter(|term| term.get("historical").and_then(serde_json::Value::as_bool) != Some(true))
        .filter_map(|term| {
            let id = term.get("termCode")?.as_str()?;
            let start = term.get("startDate")?.as_str()?;
            let end = term.get("endDate")?.as_str()?;
            (end >= today).then(|| (start.to_owned(), id.to_owned()))
        })
        .collect::<Vec<_>>();

    terms.sort_unstable();
    let ids = terms
        .into_iter()
        .take(DEFAULT_TERM_LIMIT)
        .map(|(_, id)| id)
        .collect::<Vec<_>>();
    if ids.is_empty() {
        eprintln!("Coursedog did not report any public current or upcoming terms");
        return Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR);
    }
    Ok(ids)
}

async fn join_next(
    tasks: &mut JoinSet<Result<(), axum::http::StatusCode>>,
) -> Result<(), axum::http::StatusCode> {
    match tasks.join_next().await {
        Some(Ok(result)) => result,
        Some(Err(error)) => {
            eprintln!("scraper task failed to join: {error}");
            Err(axum::http::StatusCode::INTERNAL_SERVER_ERROR)
        }
        None => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::select_default_term_ids;

    #[test]
    fn default_terms_exclude_unpublished_and_historical_terms() {
        let response = serde_json::json!({
            "terms": [
                {"termCode": "1262", "startDate": "2026-01-01", "endDate": "2026-05-01", "public": true, "historical": true},
                {"termCode": "1269", "startDate": "2026-08-28", "endDate": "2026-12-21", "public": true, "historical": false},
                {"termCode": "1271", "startDate": "2027-01-02", "endDate": "2027-01-24", "public": true, "historical": false},
                {"termCode": "1272", "startDate": "2027-01-28", "endDate": "2027-05-27", "public": true, "historical": false},
                {"termCode": "1276", "startDate": "2027-06-02", "endDate": "2027-08-19", "public": false, "historical": false}
            ]
        });

        let ids = select_default_term_ids(&response, "2026-11-05").expect("public terms");
        assert_eq!(ids, vec!["1269", "1271", "1272"]);
    }
}
