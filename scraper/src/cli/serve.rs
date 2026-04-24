use std::net::{IpAddr, Ipv4Addr, SocketAddr};

use crate::settings::Settings;

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

pub fn handle(matches: &clap::ArgMatches, settings: &Settings) -> anyhow::Result<()> {
    if let Some(matches) = matches.subcommand_matches("serve") {
        let port: u16 = *matches.get_one("port").unwrap_or(&8080);

        start_tokio(port, settings)?;
    }

    Ok(())
}

fn start_tokio(port: u16, _settings: &Settings) -> anyhow::Result<()> {
    tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()?
        .block_on(async move {
            let state = crate::api::AppState {
                client: reqwest::Client::new(),
            };

            let addr = SocketAddr::new(IpAddr::V4(Ipv4Addr::UNSPECIFIED), port);
            let listener = tokio::net::TcpListener::bind(addr).await?;
            let routes = crate::api::configure(state);

            axum::serve(listener, routes.into_make_service()).await?;

            Ok::<(), anyhow::Error>(())
        })?;

    std::process::exit(0);
}
