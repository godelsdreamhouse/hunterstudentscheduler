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

            let common_parameters = Parameters {
                section: scraped_section,
                course_group_id: &section.course_group_id,
                term_season_str,
                term_year,
                section_number,
            };

            // Replace meetings atomically so retries and weekly runs do not duplicate them.
            let mut transaction = state.pool.begin().await.map_err(database_error)?;
            let section_id =
                insert_section(&common_parameters, professors, &mut transaction).await?;
            sqlx::query!(
                "DELETE FROM section_meetings WHERE section_id = $1",
                section_id
            )
            .execute(&mut *transaction)
            .await
            .map_err(database_error)?;
            insert_section_meeting(&common_parameters, section_id, &mut transaction).await?;
            transaction.commit().await.map_err(database_error)?;
        }
    }

    Ok(())
}

fn database_error(error: sqlx::Error) -> axum::http::StatusCode {
    eprintln!("{error}");
    axum::http::StatusCode::INTERNAL_SERVER_ERROR
}

struct Parameters<'a> {
    section: &'a serde_json::Value,
    course_group_id: &'a str,
    term_season_str: &'a str,
    term_year: i32,
    section_number: &'a str,
}

async fn insert_section(
    parameters: &Parameters<'_>,
    professors: Option<&serde_json::Value>,
    connection: &mut sqlx::PgConnection,
) -> Result<i64, axum::http::StatusCode> {
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

    let class_num = parameters
        .section
        .get("callNumber")
        .and_then(serde_json::Value::as_i64)
        .unwrap_or_default();

    let row = sqlx::query!(
        "
        INSERT INTO sections (class_num,course_id,term_season,term_year,section_number,instructor,instruction_mode,max_enrollment,enrollment)
        VALUES ($9::bigint,$1,$2,$3,$4,$5,$6::text::modality,$7,$8)
        ON CONFLICT (course_id, term_season, term_year, section_number, section_component) WHERE group_code IS NULL
        DO UPDATE SET
        max_enrollment = EXCLUDED.max_enrollment,
        enrollment = EXCLUDED.enrollment,
        class_num = EXCLUDED.class_num,
        instructor = EXCLUDED.instructor,
        instruction_mode = EXCLUDED.instruction_mode
        RETURNING section_id
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
    .fetch_one(&mut *connection)
    .await
    .map_err(|error| {
        eprintln!("{error}");
        axum::http::StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(row.section_id)
}

async fn insert_section_meeting(
    parameters: &Parameters<'_>,
    section_id: i64,
    connection: &mut sqlx::PgConnection,
) -> Result<(), axum::http::StatusCode> {
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
                VALUES ($1,$2::Text[]::weekday[],$3,$4,$5)
                ",
                section_id,
                day_of_week.as_deref(),
                start_time,
                end_time,
                location
            )
            .execute(&mut *connection)
            .await
            .map_err(|error| {
                eprintln!("{error}");
                axum::http::StatusCode::INTERNAL_SERVER_ERROR
            })?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::{OutboundLimiterSettings, new_outbound_limiter};

    #[sqlx::test(migrations = false)]
    async fn repeated_sections_replace_meetings_and_roll_back_on_error(pool: sqlx::PgPool) {
        sqlx::raw_sql(include_str!("../../../../database/schema.sql"))
            .execute(&pool)
            .await
            .expect("test schema");
        sqlx::raw_sql("INSERT INTO departments VALUES ('TEST', 'Test'); INSERT INTO courses (course_id, course_code, course_name, dep_code) VALUES ('test-course', 'TEST 101', 'Test', 'TEST');")
            .execute(&pool).await.expect("test course");
        let state = AppState {
            pool: pool.clone(),
            client: reqwest::Client::new(),
            outbound_limiter: new_outbound_limiter(&OutboundLimiterSettings {
                per_second: 1,
                burst_size: 1,
            }),
        };
        let query = || {
            axum::extract::Query(Section {
                course_group_id: "test-course".into(),
                term_id: "1269".into(),
            })
        };
        let mut data = serde_json::json!({"sections": [{"sectionNumber":"01", "callNumber":12345, "maxEnrollment":30,"enrollment":10,"instructionMode":"In Person", "times":[{"day":[1],"start":900,"end":1000,"classroom":"HN 1"}]}]});
        insert_to_db(state.clone(), query(), &axum::Json(data.clone()))
            .await
            .expect("first scrape");
        data["sections"][0]["times"][0]["classroom"] = serde_json::json!("HN 2");
        insert_to_db(state.clone(), query(), &axum::Json(data.clone()))
            .await
            .expect("repeat scrape");
        let meetings: Vec<(String,)> = sqlx::query_as("SELECT location FROM section_meetings")
            .fetch_all(&pool)
            .await
            .expect("meetings");
        assert_eq!(meetings, vec![("HN 2".to_owned(),)]);
        data["sections"][0]["enrollment"] = serde_json::json!(20);
        data["sections"][0]["times"][0]["end"] = serde_json::json!(800);
        assert!(
            insert_to_db(state, query(), &axum::Json(data))
                .await
                .is_err()
        );
        let enrollment: (i32,) = sqlx::query_as("SELECT enrollment FROM sections")
            .fetch_one(&pool)
            .await
            .expect("enrollment");
        assert_eq!(enrollment.0, 10);
        let meetings: Vec<(String,)> = sqlx::query_as("SELECT location FROM section_meetings")
            .fetch_all(&pool)
            .await
            .expect("preserved meetings");
        assert_eq!(meetings, vec![("HN 2".to_owned(),)]);
    }
}
