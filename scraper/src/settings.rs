#[derive(Debug, serde::Deserialize)]
pub struct DatabaseSettings {
    #[serde(default = "DatabaseSettings::default_user")]
    pub user: String,
    #[serde(default = "DatabaseSettings::default_password")]
    pub password: String,
    #[serde(default = "DatabaseSettings::default_host")]
    pub host: String,
    #[serde(default = "DatabaseSettings::default_db")]
    pub db: String,
}

impl Default for DatabaseSettings {
    fn default() -> Self {
        Self {
            user: Self::default_user(),
            password: Self::default_password(),
            host: Self::default_host(),
            db: Self::default_db(),
        }
    }
}

impl DatabaseSettings {
    fn default_user() -> String {
        "postgres".to_string()
    }
    fn default_password() -> String {
        "postgres".to_string()
    }
    fn default_host() -> String {
        "localhost".to_string()
    }
    fn default_db() -> String {
        "watchtower".to_string()
    }
}

#[derive(Debug, serde::Deserialize, Default)]
pub struct ConfigInfo {
    pub scraper_prefix: Option<String>,
    pub postgres_prefix: Option<String>,
}

#[derive(Debug, serde::Deserialize, Default)]
pub struct Settings {
    #[serde(default)]
    pub config: ConfigInfo,
}

impl Settings {
    /// Returns a new Settings instance
    ///
    /// # Errors
    ///
    /// Can return an error if:
    /// 1. Config fails to build
    /// 2. Settings fails to deserialize
    pub fn new(scraper_prefix: &str) -> anyhow::Result<Self> {
        let source = config::Config::builder()
            .add_source(
                config::Environment::with_prefix(scraper_prefix)
                    .separator("__")
                    .prefix_separator("__"),
            )
            .add_source(
                config::Environment::with_prefix("POSTGRES")
                    .separator("_")
                    .prefix_separator("_")
                    .try_parsing(true),
            )
            .set_override("config.scraper_prefix", scraper_prefix)?
            .build()?;

        Ok(source.try_deserialize()?)
    }
}
