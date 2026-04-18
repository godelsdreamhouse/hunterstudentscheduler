// use scraper::fetcher;
use clap::{Arg, Command};
use scraper::cli;
use scraper::settings;

fn main() -> anyhow::Result<()> {
    dotenv::dotenv().ok();

    let mut command = Command::new("Scraper microservice")
        .version("0.1.0")
        .author("Jason Huang <h.jason.dev@gmail.com>")
        .about("A microservice for Watchtower")
        .arg(
            Arg::new("config")
                .short('c')
                .long("config")
                .help("Configuration file location")
                .default_value("config.json"),
        );

    command = cli::configure(command);

    let matches = command.get_matches();

    let config_location = matches
        .get_one::<String>("config")
        .map(|s| s.as_str())
        .unwrap_or("");

    let settings = settings::Settings::new(config_location, "SCRAPER")?;

    cli::handle(&matches, &settings)?;

    Ok(())
}
