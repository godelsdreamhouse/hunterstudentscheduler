use axum::extract::State;
use sqlx::types::time;

use crate::{api::AppState, fetcher::fetch_course_section};

#[derive(serde::Deserialize)]
pub struct Section {
    pub course_group_id: String,
    pub term_id: String,
}

/// Handles the `/course_section?course_group_id=:id&term_id=:id`
/// E.g., `/course_section?course_group_id=1209731&term_id=1262`
pub async fn course_section_handle(
    State(state): State<AppState>,
    section: axum::extract::Query<Section>,
) -> Result<axum::Json<serde_json::Value>, axum::http::StatusCode> {
    let results = fetch_course_section(
        &state.client,
        &state.outbound_limiter,
        &section.course_group_id,
        &section.term_id,
    )
    .await
    .map(axum::Json)
    .map_err(|error| {
        eprintln!("{error}");
        axum::http::StatusCode::INTERNAL_SERVER_ERROR
    })?;

    insert_to_db(state, section, &results).await?;

    Ok(results)
}

async fn insert_to_db(
    state: AppState,
    section: axum::extract::Query<Section>,
    results: &axum::Json<serde_json::Value>,
) -> Result<(), axum::http::StatusCode> {
    let professors = results.get("professors");

    if let Some(sections) = results.get("sections").and_then(|data| data.as_array()) {
        for scraped_section in sections {
            let term_season_str = match &section.term_id.chars().last() {
                Some('2') => "SPRING",
                Some('6') => "SUMMER",
                Some('9') => "FALL",
                _ => "WINTER",
            };
            let term_year = &section.term_id[0..3].parse::<i32>().unwrap_or_default() + 1900;
            let section_number = scraped_section
                .get("sectionNumber")
                .and_then(|section_number| section_number.as_str())
                .unwrap_or_default();
            let term_id = section.term_id.as_str();

            let common_parameters = Parameters {
                state: &state,
                section: scraped_section,
                course_group_id: &section.course_group_id,
                term_season_str,
                term_year,
                section_number,
            };

            insert_section(&common_parameters, professors, term_id).await?;

            insert_section_meeting(&common_parameters).await?;
        }
    }

    Ok(())
}

struct Parameters<'a> {
    state: &'a AppState,
    section: &'a serde_json::Value,
    course_group_id: &'a str,
    term_season_str: &'a str,
    term_year: i32,
    section_number: &'a str,
}

async fn insert_section(
    parameters: &Parameters<'_>,
    professors: Option<&serde_json::Value>,
    term_id: &str,
) -> Result<(), axum::http::StatusCode> {
    let instruction_mode = parameters
        .section
        .get("instructionMode")
        .and_then(|instruction_mode| instruction_mode.as_str())
        .unwrap_or_default();
    let max_enrollment: Option<i32> = parameters
        .section
        .get("maxEnrollment")
        .and_then(serde_json::Value::as_i64)
        .map(|capacity| i32::try_from(capacity).ok())
        .unwrap_or_default();
    let enrollment: Option<i32> = parameters
        .section
        .get("enrollment")
        .and_then(serde_json::Value::as_i64)
        .map(|enrolled| i32::try_from(enrolled).ok())
        .unwrap_or_default();
    let instruction_mode = match instruction_mode {
        "In Person" => "in_person",
        "Hybrid" => "hybrid",
        "Online Asynchronous" => "asynchronous",
        _ => "remote",
    };
    let professor_ids = parameters
        .section
        .get("professors")
        .and_then(|professors| professors.as_array());
    let instructor_id = professor_ids
        .and_then(|professors_array| professors_array.iter().next())
        .and_then(|instructor_id| instructor_id.as_str());
    let professor =
        professors.and_then(|professors| professors.get(instructor_id.unwrap_or_default()));
    let professor_first_name = professor
        .and_then(|professor| professor.get("firstName"))
        .and_then(|first_name| first_name.as_str())
        .unwrap_or("NULL");
    let professor_last_name = professor
        .and_then(|professor| professor.get("lastName"))
        .and_then(|last_name| last_name.as_str())
        .unwrap_or("NULL");
    let instructor = if professor_first_name != "NULL" && professor_last_name != "NULL" {
        format!("{professor_last_name},{professor_first_name}")
    } else {
        "NULL".to_string()
    };

    let class_number = parameters
        .section
        .get("callNumber")
        .and_then(serde_json::Value::as_i64)
        .unwrap_or_default();

    sqlx::query!(
        "
        INSERT INTO sections (class_num,course_id,term_season,term_year,section_number,instructor,instruction_mode,max_enrollment,enrollment)
        VALUES ($9::bigint,$1,$2,$3,$4,$5,$6::text::modality,$7,$8)
        ON CONFLICT (course_id, term_season, term_year, section_number, section_component) WHERE group_code IS NULL
        DO UPDATE SET
        max_enrollment = EXCLUDED.max_enrollment,
        enrollment = EXCLUDED.enrollment
        ",
        parameters
        .course_group_id,
        parameters
        .term_season_str,
        parameters
        .term_year,
        parameters
        .section_number,
        instructor,
        instruction_mode,
        max_enrollment,
        enrollment,
        class_num
    )
    .execute(&parameters.state.pool)
    .await
    .map_err(|error| {
        eprintln!("{error}");
        axum::http::StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(())
}

async fn insert_section_meeting(parameters: &Parameters<'_>) -> Result<(), axum::http::StatusCode> {
    if let Some(section_times) = parameters
        .section
        .get("times")
        .and_then(|times| times.as_array())
    {
        for time in section_times {
            let day_of_week = time.get("day").and_then(|day| day.as_array()).map(|days| {
                let mut days_of_week = vec![];

                for day in days {
                    let day = match day.as_i64() {
                        Some(1) => "Monday",
                        Some(2) => "Tuesday",
                        Some(3) => "Wednesday",
                        Some(4) => "Thursday",
                        Some(5) => "Friday",
                        Some(6) => "Saturday",
                        Some(7) => "Sunday",
                        _ => continue,
                    };

                    days_of_week.push(day.to_string());
                }

                days_of_week
            });
            let start_time = time
                .get("start")
                .and_then(serde_json::Value::as_i64)
                .and_then(|start| {
                    let hour = u8::try_from(start / 100).unwrap_or_default();
                    let minute = u8::try_from(start % 100).unwrap_or_default();
                    time::Time::from_hms(hour, minute, 0).ok()
                })
                .unwrap_or(time::Time::MIDNIGHT);
            let end_time = time
                .get("end")
                .and_then(serde_json::Value::as_i64)
                .and_then(|start| {
                    let hour = u8::try_from(start / 100).unwrap_or_default();
                    let minute = u8::try_from(start % 100).unwrap_or_default();
                    time::Time::from_hms(hour, minute, 0).ok()
                })
                .unwrap_or(time::Time::MAX);
            let location = time
                .get("classroom")
                .and_then(|location| location.as_str())
                .unwrap_or_default();

            sqlx::query!(
                "
                INSERT INTO section_meetings (section_id,day_of_week,start_time,end_time,location)
                VALUES ((SELECT section_id FROM sections WHERE course_id = $1 AND term_season = $2 AND term_year = $3 AND section_number = $4),$5::Text[]::weekday[],$6,$7,$8)
                ",
                parameters.course_group_id,
                parameters.term_season_str,
                parameters.term_year,
                parameters.section_number,
                day_of_week.as_deref(),
                start_time,
                end_time,
                location
            )
            .execute(&parameters.state.pool)
            .await
            .map_err(|error| {
                eprintln!("{error}");
                axum::http::StatusCode::INTERNAL_SERVER_ERROR
            })?;
        }
    }

    Ok(())
}
