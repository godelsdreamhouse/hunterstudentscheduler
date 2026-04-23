#[derive(Debug, serde::Deserialize, Default)]
pub struct ConfigInfo {
    pub env_prefix: Option<String>,
}

#[derive(Debug, serde::Deserialize, Default)]
pub struct Settings {
    #[serde(default)]
    pub config: ConfigInfo,
}

impl Settings {
    pub fn new(env_prefix: &str) -> anyhow::Result<Self> {
        let s = config::Config::builder()
            .add_source(
                config::Environment::with_prefix(env_prefix)
                    .separator("__")
                    .prefix_separator("__"),
            )
            .set_override("config.env_prefix", env_prefix)?
            .build()?;

        let settings = s.try_deserialize()?;

        Ok(settings)
    }
}
