use super::handlers;

pub fn configure(state: crate::api::AppState) -> axum::Router {
    axum::Router::new()
        .route(
            "/course_list",
            axum::routing::get(handlers::course_list::course_list),
        )
        .route(
            "/course_detail/{id}",
            axum::routing::get(handlers::course_detail::course_detail),
        )
        .route(
            "/course_section",
            axum::routing::get(handlers::course_section::course_section),
        )
        .route(
            "/current_term",
            axum::routing::get(handlers::current_term::current_term),
        )
        .route(
            "/all_terms",
            axum::routing::get(handlers::all_terms::all_terms),
        )
        .route(
            "/course_requirements/{id}",
            axum::routing::get(handlers::course_requirements::course_requirements),
        )
        .with_state(state)
}
