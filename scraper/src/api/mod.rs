mod handlers;
mod v1;

pub fn configure() -> axum::Router {
    axum::Router::new().nest("/v1", v1::configure())
}
