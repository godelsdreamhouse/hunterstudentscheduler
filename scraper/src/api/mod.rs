use std::{num::NonZeroU32, sync::Arc, time::Duration};

use governor::{DefaultDirectRateLimiter, Quota, RateLimiter};

pub mod handlers;
mod v1;

#[derive(Clone)]
pub struct AppState {
    pub client: reqwest::Client, // Client already uses ARC internally, no need to wrap it
    pub outbound_limiter: Arc<DefaultDirectRateLimiter>,
    pub pool: sqlx::postgres::PgPool,
}

pub struct OutboundLimiterSettings {
    pub per_second: u32,
    pub burst_size: u32,
}

/// Builds the shared Coursedog client with finite connection and request waits.
///
/// # Errors
///
/// Returns an error if reqwest cannot construct the client.
pub fn new_http_client() -> anyhow::Result<reqwest::Client> {
    Ok(reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(60))
        .build()?)
}

/// Returns a new outbound rate limiter
pub fn new_outbound_limiter(settings: &OutboundLimiterSettings) -> Arc<DefaultDirectRateLimiter> {
    // Outbound Limiter
    let quota = Quota::per_second(
        NonZeroU32::new(settings.per_second).expect("rate limit must be nonzrero"),
    )
    .allow_burst(NonZeroU32::new(settings.burst_size).expect("burst size must be nonzero"));

    Arc::new(RateLimiter::direct(quota))
}

/// Configures API routes
pub fn configure(state: AppState) -> axum::Router {
    axum::Router::new().nest("/v1", v1::configure(state))
}

#[cfg(test)]
mod tests {
    #[test]
    fn configured_http_client_builds() -> anyhow::Result<()> {
        super::new_http_client()?;
        Ok(())
    }
}
