use super::handlers;

pub fn configure() -> axum::Router {
    axum::Router::new().route("/hello", axum::routing::get(handlers::hello::hello))
}
