use reqwest::{Client, Url};

#[tokio::test]
async fn test_fetch_course_list() {
    match fetch_course_list("0", "2").await {
        Ok(response) => println!("{response}"),
        Err(error) => panic!("Failed fetch course list with error: {error}"),
    }
}

/// Fetches list of courses from the Coursedog API.
///
/// # Errors
///
/// Returns an error if:
/// 1. `reqwest` fails to parse api url.
/// 2. `reqwest` fails to fetch from API.
/// 3. `serde` fails to parse response.
pub async fn fetch_course_list(
    skip: &str,
    limit: &str,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    let url = Url::parse_with_params(
        "https://app.coursedog.com/api/v1/cm/htr01/courses/search/$filters",
        &[
            ("skip", skip),
            ("limit", limit),
            ("orderBy", "code"),
            ("ignoreEffectiveDating", "false"),
            (
                "columns",
                "displayName,department,name,courseNumber,subjectCode,code,courseGroupId,credits.creditHours,longName,career,components,customFields.catalogRequirementDesignation,customFields.catalogAttributes",
            ),
        ],
    );

    let response = Client::new()
        .post(url?)
        .header("Accept", "application/json")
        .header("Origin", "https://hunter-undergraduate.catalog.cuny.edu")
        .header("Content-Type", "application/json")
        .json(&serde_json::json!(
            {
              "condition": "AND",
              "filters": [
                {
                  "filters": [
                    {
                      "id": "status-course",
                      "condition": "field",
                      "name": "status",
                      "inputType": "select",
                      "group": "course",
                      "type": "is",
                      "value": "Active",
                      "customField": false,
                    },
                    {
                      "id": "catalogPrint-course",
                      "condition": "field",
                      "name": "catalogPrint",
                      "inputType": "boolean",
                      "group": "course",
                      "type": "is",
                      "value": true,
                      "customField": false,
                    },
                    {
                      "id": "career-course",
                      "condition": "field",
                      "name": "career",
                      "inputType": "careerSelect",
                      "group": "course",
                      "type": "is",
                      "value": "Undergraduate",
                      "customField": false,
                    },
                  ],
                  "id": "zvOi8Ggo",
                  "condition": "and",
                },
              ],
            }
        ))
        .send()
        .await?
        .json::<serde_json::Value>()
        .await?;

    Ok(response)
}

#[tokio::test]
async fn test_fetch_course_detail() {
    match fetch_course_detail("1209731").await {
        Ok(response) => println!("{response}"),
        Err(error) => panic!("Failed fetch course detail with error: {error}"),
    }
}

/// Fetches details about a course from the Coursedog API.
///
/// # Errors
///
/// Returns an error if:
/// 1. `reqwest` fails to parse api url.
/// 2. `reqwest` fails to fetch from API.
/// 3. `serde` fails to parse response.
pub async fn fetch_course_detail(
    course_group_id: &str,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    let url = Url::parse_with_params(
        "https://app.coursedog.com/api/v1/cm/htr01/courses/search/$filters",
        &[
            ("courseGroupId", course_group_id),
            ("includeRelatedData", "true"),
            ("includeCrosslisted", "true"),
            ("includeCourseEquivalencies", "true"),
            (
                "columns",
                "departments,courseTypicallyOffered,career,credits,components,topics,catalogAttributes,description,requirementGroup,courseSchedule,customFields.ZK6fC,longName,institution,consent,customFields.cuPathwaysAttribute,subjectCode,courseNumber,customFields.cuLibartsFlag,code,name,college,status,institutionId,rawCourseId,crseOfferNbr,customFields.catalogAttributes,customFields.rawCourseId,sisId",
            ),
        ],
    );

    let response = Client::new()
        .get(url?)
        .header("Accept", "application/json")
        .header("Origin", "https://hunter-undergraduate.catalog.cuny.edu")
        .send()
        .await?
        .json::<serde_json::Value>()
        .await?;

    Ok(response)
}

#[tokio::test]
async fn test_fetch_course_section() {
    match fetch_course_section("1209731", "1262").await {
        Ok(response) => println!("{response}"),
        Err(error) => panic!("Failed fetch course section with error: {error}"),
    }
}

/// Fetches details about a section for a course from the Coursedog API.
///
/// # Errors
///
/// Returns an error if:
/// 1. `reqwest` fails to parse api url.
/// 2. `reqwest` fails to fetch from API.
/// 3. `serde` fails to parse response.
pub async fn fetch_course_section(
    course_group_id: &str,
    term_id: &str,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    let url = Url::parse_with_params(
        &format!("https://app.coursedog.com/api/v1/ca/htr01/sections/{term_id}/{course_group_id}"),
        &[
            ("includeRelatedData", "true"),
            (
                "returnFields",
                "callNumber,sectionNumber,days,times,dates,instructionMode,enrollment,maxEnrollment,startDate,endDate",
            ),
        ],
    );

    let response = Client::new()
        .get(url?)
        .header("Accept", "application/json")
        .header("Origin", "https://hunter-undergraduate.catalog.cuny.edu")
        .send()
        .await?
        .json::<serde_json::Value>()
        .await?;

    Ok(response)
}

#[tokio::test]
async fn test_fetch_current_term() {
    let response = match fetch_current_term().await {
        Ok(response) => {
            println!("{response}");
            response
        }
        Err(error) => {
            panic!("Failed fetch current term with error: {error}")
        }
    };

    if let Some(term_id) = response.get("id") {
        println!("\nID: {term_id}");
    }

    let Some(year) = response.get("year") else {
        panic!("Failed to find year");
    };

    if let Some(semester) = response.get("semester") {
        match semester.as_i64() {
            Some(1) => println!("Semester: Winter {year}"),
            Some(2) => println!("Semester: Spring {year}"),
            Some(3) => println!("Semester: Summer {year}"),
            Some(4) => println!("Semester: Fall {year}"),
            _ => println!("N/A"),
        }
    }
}

/// Fetches current term from the Coursedog API.
///
/// # Errors
///
/// Returns an error if:
/// 1. `reqwest` fails to parse api url.
/// 2. `reqwest` fails to fetch from API.
/// 3. `serde` fails to parse response.
pub async fn fetch_current_term() -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    let url = Url::parse("https://app.coursedog.com/api/v1/htr01/general/currentTerm");

    let response = Client::new()
        .get(url?)
        .header("Accept", "application/json")
        .header("Origin", "https://hunter-undergraduate.catalog.cuny.edu")
        .send()
        .await?
        .json::<serde_json::Value>()
        .await?;

    Ok(response)
}

#[tokio::test]
async fn test_fetch_all_terms() {
    match fetch_all_terms().await {
        Ok(response) => println!("{response}"),
        Err(error) => panic!("Failed fetch all terms with error: {error}"),
    }
}

/// Fetches all terms from the Coursedog API.
///
/// # Errors
///
/// Returns an error if:
/// 1. `reqwest` fails to parse api url.
/// 2. `reqwest` fails to fetch from API.
/// 3. `serde` fails to parse response.
pub async fn fetch_all_terms() -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    let url = Url::parse("https://app.coursedog.com/api/v1/htr01/general/terms");

    let response = Client::new()
        .get(url?)
        .header("Accept", "application/json")
        .header("Origin", "https://hunter-undergraduate.catalog.cuny.edu")
        .send()
        .await?
        .json::<serde_json::Value>()
        .await?;

    Ok(response)
}

#[tokio::test]
async fn test_fetch_course_requirements() {
    match fetch_course_requirements("017240").await {
        Ok(response) => println!("{response}"),
        Err(error) => panic!("Failed fetch current term with error: {error}"),
    }
}

/// Fetches requirements for a course from the Coursedog API.
///
/// # Errors
///
/// Returns an error if:
/// 1. `reqwest` fails to parse api url.
/// 2. `reqwest` fails to fetch from API.
/// 3. `serde` fails to parse response.
pub async fn fetch_course_requirements(
    course_group_id: &str,
) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
    let url = Url::parse_with_params(
        &format!("https://app.coursedog.com/api/v1/htr01/requirementGroups/{course_group_id}"),
        &[(
            "returnFields",
            "code,catalogDisplayName,displayName,descriptionLong",
        )],
    );

    let response = Client::new()
        .get(url?)
        .header("Accept", "application/json")
        .header("Origin", "https://hunter-undergraduate.catalog.cuny.edu")
        .send()
        .await?
        .json::<serde_json::Value>()
        .await?;

    Ok(response)
}
