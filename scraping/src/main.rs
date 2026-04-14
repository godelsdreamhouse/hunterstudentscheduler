use reqwest::{Client, Url};

#[tokio::main(flavor = "multi_thread", worker_threads = 10)]
async fn main() {
    let _ = fetch_course_detail("1209731", "1", "8").await;
}

async fn fetch_course_detail(
    course_group_id: &str,
    limit: &str,
    skip: &str,
) -> Result<String, reqwest::Error> {
    let url = Url::parse_with_params(
        "https://app.coursedog.com/api/v1/cm/htr01/courses/search/$filters",
        &[
            ("courseGroupId", course_group_id),
            ("includeRelatedData", "true"),
            ("includeCrosslisted", "true"),
            ("includeCourseEquivalencies", "true"),
            ("limit", limit),
            ("skip", skip),
            (
                "columns",
                "departments,courseTypicallyOffered,career,credits,components,topics,catalogAttributes,description,requirementGroup,courseSchedule,customFields.ZK6fC,longName,institution,consent,customFields.cuPathwaysAttribute,subjectCode,courseNumber,customFields.cuLibartsFlag,code,name,college,status,institutionId,rawCourseId,crseOfferNbr,customFields.catalogAttributes,customFields.rawCourseId,sisId",
            ),
        ],
    );

    let response = Client::new()
        .get(url.unwrap())
        .header("Accept", "application/json")
        .header("Origin", "https://hunter-undergraduate.catalog.cuny.edu")
        .send()
        .await
        .unwrap()
        .text()
        .await
        .unwrap();

    println!("{response:?}");

    Ok(response)
}
