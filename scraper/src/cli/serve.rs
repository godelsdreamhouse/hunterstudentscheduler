use std::{
    net::{IpAddr, Ipv4Addr, SocketAddr},
    sync::Arc,
};

use tower_governor::{GovernorLayer, governor::GovernorConfigBuilder};

use crate::{api::new_outbound_limiter, settings::Settings};

/// Configure `serve` command
pub fn configure() -> clap::Command {
    clap::Command::new("serve").about("Start HTTP server").arg(
        clap::Arg::new("port")
            .short('p')
            .long("port")
            .value_name("PORT")
            .help("TCP port to listen on")
            .default_value("8080")
            .value_parser(clap::value_parser!(u16)),
    )
}

/// Handles `serve` command and starts tokio
pub fn handle(matches: &clap::ArgMatches, settings: &Settings) -> anyhow::Result<()> {
    if let Some(matches) = matches.subcommand_matches("serve") {
        let port: u16 = *matches.get_one("port").unwrap_or(&8080);

        start_server(port, settings)?;
    }

    Ok(())
}
/// Starts the server with a new tokio runtime.
/// The server starts with both inbound and outbound limiters.
///
/// # Errors
///
/// Can fail if:
/// 1. Tokio runtime fails to build
/// 2. Inbound limiter configuration fails to build
/// 3. Tokio fails to bind a listener to the address
/// 4. Axum fails to serve
/// 5. Tokio runtime fails
fn start_server(port: u16, _settings: &Settings) -> anyhow::Result<()> {
    tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()?
        .block_on(async move {
            let state = crate::api::AppState {
                client: reqwest::Client::new(),
                outbound_limiter: new_outbound_limiter(5),
            };

            // Inbound Limiter
            let governor_configuration = Arc::new(
                GovernorConfigBuilder::default()
                    .per_second(2)
                    .burst_size(5)
                    .finish()
                    .ok_or_else(|| anyhow::anyhow!("Invalid rate limiter configuration"))?,
            );

            let addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::UNSPECIFIED), port);
            let listener = tokio::net::TcpListener::bind(addr).await?;
            let routes =
                crate::api::configure(state).layer(GovernorLayer::new(governor_configuration));

            axum::serve(
                listener,
                routes.into_make_service_with_connect_info::<SocketAddr>(),
            )
            .await?;

            Ok::<(), anyhow::Error>(())
        })?;

    std::process::exit(0);
}
