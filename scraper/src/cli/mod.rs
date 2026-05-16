mod scrape;
mod serve;
use crate::settings::Settings;

/// Configures CLI
#[must_use]
pub fn configure(command: clap::Command) -> clap::Command {
    command
        .subcommand(serve::configure())
        .subcommand(scrape::configure())
}

/// Handles CLI and settings
///
/// # Errors
///
/// Can fail if CLI commands handles fail
pub fn handle(matches: &clap::ArgMatches, settings: &Settings) -> anyhow::Result<()> {
    serve::handle(matches, settings)?;
    scrape::handle(matches, settings)?;

    Ok(())
}
