use std::{num::NonZeroU32, sync::Arc};

use governor::{DefaultDirectRateLimiter, Quota, RateLimiter};

mod handlers;
mod v1;

#[derive(Clone)]
pub struct AppState {
    pub client: reqwest::Client, // Client already uses ARC internally, no need to wrap it
    pub outbound_limiter: Arc<DefaultDirectRateLimiter>,
}

pub fn new_outbound_limiter(per_second: u32) -> Arc<DefaultDirectRateLimiter> {
    // Outbound Limiter
    let quota =
        Quota::per_second(NonZeroU32::new(per_second).expect("rate limit must be nonzrero"));
    Arc::new(RateLimiter::direct(quota))
}

pub fn configure(state: AppState) -> axum::Router {
    axum::Router::new().nest("/v1", v1::configure(state))
}
