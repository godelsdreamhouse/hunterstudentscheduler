mod handlers;
mod v1;

#[derive(Clone)]
pub struct AppState {
    pub client: reqwest::Client, // Client already uses ARC internally, no need to wrap it
}

pub fn configure(state: AppState) -> axum::Router {
    axum::Router::new().nest("/v1", v1::configure(state))
}
