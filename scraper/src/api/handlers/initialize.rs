use axum::extract::State;
use chrono::Datelike;

use crate::api::{
    AppState,
    handlers::{
        course_list::{Pagination, course_list_handle},
        course_requirements::{Ids, course_requirements_handle},
        course_section::{Section, course_section_handle},
    },
};

/// Handles the `/initialize` route
pub async fn initialize_handle(
    State(state): State<AppState>,
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

    let now = chrono::Local::now();
    let year = now.year();
    let month = now.month();

    let mut year_prefix = year - 1900;

    let current_term_postfix = match month {
        month if month <= 5 => 2,
        month if month <= 8 => 6,
        month if month <= 12 => 9,
        _ => 2,
    };

    let mut term_ids = vec![format!("{year_prefix}{current_term_postfix}")];

    if current_term_postfix == 9 {
        year_prefix += 1;
    }

    let second_term_postfix = match current_term_postfix {
        6 => 9,
        9 => 2,
        _ => 6,
    };

    term_ids.push(format!("{year_prefix}{second_term_postfix}"));

    if current_term_postfix == 6 {
        year_prefix += 1;
    }

    let third_term_postfix = match second_term_postfix {
        6 => 9,
        9 => 2,
        _ => 6,
    };

    term_ids.push(format!("{year_prefix}{third_term_postfix}"));

    for id in &ids.0 {
        for term_id in &term_ids {
            let _ = course_section_handle(
                State(state.clone()),
                axum::extract::Query(Section {
                    course_group_id: id.0.clone(),
                    term_id: term_id.clone(),
                }),
            )
            .await
            .map_err(|error| {
                eprintln!("{error}");
                axum::http::StatusCode::INTERNAL_SERVER_ERROR
            })?;
        }
    }

    for id in ids.0.iter().filter(|id| id.1.is_some()) {
        let requirement_id = id.1.clone().unwrap_or_else(String::new);

        let _ = course_requirements_handle(
            State(state.clone()),
            axum::extract::Query(Ids {
                requirement_id,
                course_group_id: id.0.clone(),
            }),
        )
        .await
        .map_err(|error| {
            eprintln!("{error}");
            axum::http::StatusCode::INTERNAL_SERVER_ERROR
        })?;
    }

    Ok(())
}
