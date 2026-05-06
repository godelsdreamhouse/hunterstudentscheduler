mod serve;
use crate::settings::Settings;

#[must_use]
pub fn configure(command: clap::Command) -> clap::Command {
    command.subcommand(serve::configure())
}

pub fn handle(matches: &clap::ArgMatches, settings: &Settings) -> anyhow::Result<()> {
    serve::handle(matches, settings)?;

    Ok(())
}
