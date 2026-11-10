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

            // Coursedog returns cancelled sections alongside active offerings.
            // Remove a previously scraped copy instead of presenting it as a
            // schedulable section.
            if scraped_section
                .get("status")
                .and_then(serde_json::Value::as_str)
                == Some("Cancelled Section")
            {
                delete_cancelled_section(&common_parameters, &state.pool).await?;
                continue;
            }

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

async fn delete_cancelled_section(
    parameters: &Parameters<'_>,
    pool: &sqlx::PgPool,
) -> Result<(), axum::http::StatusCode> {
    sqlx::query(
        r#"
        DELETE FROM sections
        WHERE term_season = $1
          AND term_year = $2
          AND course_id = $3
          AND section_number = $4
          AND section_component = 'lecture'::component
          AND group_code IS NULL
        "#,
    )
    .bind(parameters.term_season_str)
    .bind(parameters.term_year)
    .bind(parameters.course_group_id)
    .bind(parameters.section_number)
    .execute(pool)
    .await
    .map_err(database_error)?;

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
    let waitlist_max_enrollment: Option<i32> = parameters
        .section
        .get("maxWaitlist")
        .and_then(serde_json::Value::as_i64)
        .and_then(|capacity| i32::try_from(capacity).ok());
    let waitlist_count: Option<i32> = parameters
        .section
        .get("waitlist")
        .and_then(serde_json::Value::as_i64)
        .and_then(|count| i32::try_from(count).ok());
    let instruction_mode = match instruction_mode {
        "In Person" => "in_person",
        "Hybrid" => "hybrid",
        "Online Asynchronous" => "asynchronous",
        _ => "remote",
    };
    let instructor = instructor_names(parameters.section, professors);

    let class_num = parameters
        .section
        .get("callNumber")
        .and_then(serde_json::Value::as_i64)
        .and_then(|call_number| i32::try_from(call_number).ok())
        .unwrap_or_default();

    // Hunter can reassign a class number after a section has already been scraped.
    // Serialize writes for the canonical class/term identity, then remove the stale
    // owner before upserting by the logical course/section identity below.
    let class_term_key = format!(
        "{}:{}:{}",
        class_num, parameters.term_season_str, parameters.term_year
    );
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))")
        .bind(class_term_key)
        .execute(&mut *connection)
        .await
        .map_err(database_error)?;
    sqlx::query!(
        r#"
        DELETE FROM sections
        WHERE class_num = $1
          AND term_season = $2
          AND term_year = $3
          AND (
            course_id <> $4
            OR section_number <> $5
            OR section_component <> 'lecture'::component
            OR group_code IS NOT NULL
          )
        "#,
        class_num,
        parameters.term_season_str,
        parameters.term_year,
        parameters.course_group_id,
        parameters.section_number
    )
    .execute(&mut *connection)
    .await
    .map_err(database_error)?;

    let row = sqlx::query!(
        "
        INSERT INTO sections (class_num,course_id,term_season,term_year,section_number,instructor,instruction_mode,max_enrollment,enrollment,waitlist_max_enrollment,waitlist_count)
        VALUES ($11::int,$1,$2,$3,$4,$5,$6::text::modality,$7,$8,$9,$10)
        ON CONFLICT (course_id, term_season, term_year, section_number, section_component) WHERE group_code IS NULL
        DO UPDATE SET
        max_enrollment = EXCLUDED.max_enrollment,
        enrollment = EXCLUDED.enrollment,
        class_num = EXCLUDED.class_num,
        instructor = EXCLUDED.instructor,
        instruction_mode = EXCLUDED.instruction_mode,
        waitlist_max_enrollment = EXCLUDED.waitlist_max_enrollment,
        waitlist_count = EXCLUDED.waitlist_count
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
        instructor.as_deref(),
        instruction_mode,
        max_enrollment,
        enrollment,
        waitlist_max_enrollment,
        waitlist_count,
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

fn instructor_names(
    section: &serde_json::Value,
    professors: Option<&serde_json::Value>,
) -> Option<String> {
    let names = section
        .get("professors")
        .and_then(serde_json::Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(serde_json::Value::as_str)
        .filter_map(|instructor_id| professors?.get(instructor_id))
        .filter_map(|professor| {
            let first_name = professor.get("firstName")?.as_str()?.trim();
            let last_name = professor.get("lastName")?.as_str()?.trim();
            (!first_name.is_empty() && !last_name.is_empty())
                .then(|| format!("{last_name},{first_name}"))
        })
        .collect::<Vec<_>>();

    (!names.is_empty()).then(|| names.join("; "))
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
            let Some(day_of_week) = time.get("day").and_then(|day| day.as_array()).map(|days| {
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
            }) else {
                continue;
            };
            // A TBA record has no schedulable day/time. Do not turn missing
            // values into an invented all-day meeting.
            if day_of_week.is_empty() {
                continue;
            }
            let Some(start) = time.get("start").and_then(serde_json::Value::as_i64) else {
                continue;
            };
            let Some(end) = time.get("end").and_then(serde_json::Value::as_i64) else {
                continue;
            };
            let Some(start_time) = ({
                let hour = u8::try_from(start / 100).unwrap_or_default();
                let minute = u8::try_from(start % 100).unwrap_or_default();
                time::Time::from_hms(hour, minute, 0).ok()
            }) else {
                continue;
            };
            let Some(end_time) = ({
                let hour = u8::try_from(end / 100).unwrap_or_default();
                let minute = u8::try_from(end % 100).unwrap_or_default();
                time::Time::from_hms(hour, minute, 0).ok()
            }) else {
                continue;
            };
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
                day_of_week.as_slice(),
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
        let mut data = serde_json::json!({
            "sections": [{
                "sectionNumber":"01",
                "callNumber":12345,
                "maxEnrollment":30,
                "enrollment":10,
                "maxWaitlist":20,
                "waitlist":3,
                "status":"Active",
                "instructionMode":"In Person",
                "professors":["primary", "secondary"],
                "times":[
                    {"day":[1],"start":900,"end":1000,"classroom":"HN 1"},
                    {"day":[],"start":null,"end":null,"classroom":"HTR-TBA"}
                ]
            }],
            "professors": {
                "primary": {"firstName":"Ada", "lastName":"Lovelace"},
                "secondary": {"firstName":"Grace", "lastName":"Hopper"}
            }
        });
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
        let section_values: (Option<String>, i32, i32) = sqlx::query_as(
            "SELECT instructor, waitlist_max_enrollment, waitlist_count FROM sections",
        )
        .fetch_one(&pool)
        .await
        .expect("section values");
        assert_eq!(
            section_values,
            (Some("Lovelace,Ada; Hopper,Grace".to_owned()), 20, 3)
        );
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

    #[sqlx::test(migrations = false)]
    async fn reassigned_class_number_replaces_stale_owner(pool: sqlx::PgPool) {
        sqlx::raw_sql(include_str!("../../../../database/schema.sql"))
            .execute(&pool)
            .await
            .expect("test schema");
        sqlx::raw_sql(
            "INSERT INTO departments VALUES ('TEST', 'Test');
             INSERT INTO courses (course_id, course_code, course_name, dep_code) VALUES
               ('current-course', 'TEST 101', 'Current', 'TEST'),
               ('stale-course', 'TEST 102', 'Stale', 'TEST');
             INSERT INTO sections (class_num, course_id, term_season, term_year, section_number)
             VALUES
               (12345, 'stale-course', 'FALL', 2026, '99'),
               (99999, 'current-course', 'FALL', 2026, '01');",
        )
        .execute(&pool)
        .await
        .expect("stale sections");
        let state = AppState {
            pool: pool.clone(),
            client: reqwest::Client::new(),
            outbound_limiter: new_outbound_limiter(&OutboundLimiterSettings {
                per_second: 1,
                burst_size: 1,
            }),
        };
        let query = axum::extract::Query(Section {
            course_group_id: "current-course".into(),
            term_id: "1269".into(),
        });
        let data = serde_json::json!({
            "sections": [{
                "sectionNumber": "01",
                "callNumber": 12345,
                "maxEnrollment": 30,
                "enrollment": 10,
                "instructionMode": "In Person",
                "times": []
            }]
        });

        insert_to_db(state, query, &axum::Json(data))
            .await
            .expect("reassigned class number");

        let sections: Vec<(i32, String, String)> = sqlx::query_as(
            "SELECT class_num, course_id, section_number FROM sections ORDER BY section_id",
        )
        .fetch_all(&pool)
        .await
        .expect("sections");
        assert_eq!(
            sections,
            vec![(12345, "current-course".to_owned(), "01".to_owned())]
        );
    }

    #[sqlx::test(migrations = false)]
    async fn cancelled_section_removes_previously_scraped_copy(pool: sqlx::PgPool) {
        sqlx::raw_sql(include_str!("../../../../database/schema.sql"))
            .execute(&pool)
            .await
            .expect("test schema");
        sqlx::raw_sql(
            "INSERT INTO departments VALUES ('TEST', 'Test');
             INSERT INTO courses (course_id, course_code, course_name, dep_code)
             VALUES ('test-course', 'TEST 101', 'Test', 'TEST');
             INSERT INTO sections (class_num, course_id, term_season, term_year, section_number)
             VALUES (12345, 'test-course', 'SPRING', 2027, '01');",
        )
        .execute(&pool)
        .await
        .expect("stale section");
        let state = AppState {
            pool: pool.clone(),
            client: reqwest::Client::new(),
            outbound_limiter: new_outbound_limiter(&OutboundLimiterSettings {
                per_second: 1,
                burst_size: 1,
            }),
        };
        let query = axum::extract::Query(Section {
            course_group_id: "test-course".into(),
            term_id: "1272".into(),
        });
        let data = serde_json::json!({
            "sections": [{
                "sectionNumber": "01",
                "callNumber": 12345,
                "status": "Cancelled Section"
            }]
        });

        insert_to_db(state.clone(), query, &axum::Json(data.clone()))
            .await
            .expect("cancelled section");

        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM sections")
            .fetch_one(&pool)
            .await
            .expect("section count");
        assert_eq!(count.0, 0);

        // A class number can be reassigned to another section. A later
        // cancellation record for the old section must not remove its new owner.
        sqlx::query(
            "INSERT INTO sections (class_num, course_id, term_season, term_year, section_number)
             VALUES (12345, 'test-course', 'SPRING', 2027, '02')",
        )
        .execute(&pool)
        .await
        .expect("reassigned section");
        insert_to_db(
            state,
            axum::extract::Query(Section {
                course_group_id: "test-course".into(),
                term_id: "1272".into(),
            }),
            &axum::Json(data),
        )
        .await
        .expect("stale cancellation");

        let section_numbers: Vec<(String,)> = sqlx::query_as("SELECT section_number FROM sections")
            .fetch_all(&pool)
            .await
            .expect("remaining sections");
        assert_eq!(section_numbers, vec![("02".to_owned(),)]);
    }

    #[test]
    fn instructor_names_preserve_every_resolved_instructor() {
        let section = serde_json::json!({"professors": ["one", "missing", "two"]});
        let professors = serde_json::json!({
            "one": {"firstName": "Ada", "lastName": "Lovelace"},
            "two": {"firstName": "Grace", "lastName": "Hopper"}
        });

        assert_eq!(
            instructor_names(&section, Some(&professors)),
            Some("Lovelace,Ada; Hopper,Grace".to_owned())
        );
    }
}
