use super::handlers;

/// Configures API routes for v1
pub fn configure(state: crate::api::AppState) -> axum::Router {
    axum::Router::new()
        .route(
            "/course_list",
            axum::routing::get(handlers::course_list::course_list_handle),
        )
        .route(
            "/course_section",
            axum::routing::get(handlers::course_section::course_section_handle),
        )
        .route(
            "/current_term",
            axum::routing::get(handlers::current_term::current_term_handle),
        )
        .route(
            "/all_terms",
            axum::routing::get(handlers::all_terms::all_terms_handle),
        )
        .route(
            "/course_requirements",
            axum::routing::get(handlers::course_requirements::course_requirements_handle),
        )
        .with_state(state)
}
