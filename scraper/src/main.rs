// use scraper::fetcher;
use clap::Command;
use scraper::cli;
use scraper::settings;

fn main() -> anyhow::Result<()> {
    dotenv::dotenv().ok();

    let mut command = Command::new("Scraper microservice")
        .version("0.1.0")
        .author("Jason Huang <h.jason.dev@gmail.com>")
        .about("A microservice for Watchtower");

    command = cli::configure(command);

    let matches = command.get_matches();

    let settings = settings::Settings::new("SCRAPER")?;

    cli::handle(&matches, &settings)?;

    Ok(())
}
