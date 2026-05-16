use axum::extract::State;

use crate::{
    api::{OutboundLimiterSettings, new_outbound_limiter},
    settings::Settings,
};

/// Configure `scrape` command
pub fn configure() -> clap::Command {
    clap::Command::new("scrape")
        .about("Runs scraping and exits")
        .arg(
            clap::Arg::new("postgres_user")
                .short('u')
                .long("postgres_user")
                .value_name("POSTGRES_USER")
                .help("Username for the PostgreSQL database")
                .value_parser(clap::value_parser!(String)),
        )
        .arg(
            clap::Arg::new("postgres_password")
                .short('s')
                .long("postgres_password")
                .value_name("POSTGRES_PASSWORD")
                .help("Password for the PostgreSQL database")
                .value_parser(clap::value_parser!(String)),
        )
}

/// Handles `scrape` command and starts tokio
pub fn handle(matches: &clap::ArgMatches, settings: &Settings) -> anyhow::Result<()> {
    if let Some(matches) = matches.subcommand_matches("scrape") {
        let postgres_user: &str = matches
            .get_one::<String>("postgres_user")
            .map_or(&settings.postgres.user, String::as_str);
        let postgres_password: &str = matches
            .get_one::<String>("postgres_password")
            .map_or(&settings.postgres.password, String::as_str);

        scrape(postgres_user, postgres_password, settings)?;
    }

    Ok(())
}

/// Starts scraping with a new tokio runtime.
///
/// # Errors
///
/// Can fail if:
/// 1. Tokio runtime fails to build
/// 2. Db fails to connect
/// 3. Scraping fails
fn scrape(postgres_user: &str, postgres_password: &str, settings: &Settings) -> anyhow::Result<()> {
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?
        .block_on(async move {
            let pool = sqlx::postgres::PgPoolOptions::new()
                .max_connections(5)
                .acquire_timeout(std::time::Duration::from_secs(5))
                .connect(
                    format!(
                        "postgres://{postgres_user}:{postgres_password}@{}:5432/{}",
                        settings.postgres.host, settings.postgres.db
                    )
                    .as_str(),
                )
                .await?;

            let state = crate::api::AppState {
                client: reqwest::Client::new(),
                outbound_limiter: new_outbound_limiter(&OutboundLimiterSettings {
                    per_second: 20,
                    burst_size: 10,
                }),
                pool,
            };

            println!("Starting scraping!");

            crate::api::handlers::initialize::initialize_handle(State(state))
                .await
                .map_err(|error| {
                    eprintln!("{error}");
                    anyhow::anyhow!("Scrape failed: {error}")
                })?;

            Ok::<(), anyhow::Error>(())
        })?;

    Ok(())
}
