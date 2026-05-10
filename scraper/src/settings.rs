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

#[derive(Debug, serde::Deserialize)]
pub struct ScraperSettings {
    #[serde(default = "ScraperSettings::default_port")]
    pub port: u16,
}

impl Default for ScraperSettings {
    fn default() -> Self {
        Self {
            port: Self::default_port(),
        }
    }
}

impl ScraperSettings {
    const fn default_port() -> u16 {
        8080
    }
}

#[derive(Debug, serde::Deserialize, Default)]
pub struct ConfigInfo {
    pub scraper_prefix: Option<String>,
}

#[derive(Debug, serde::Deserialize, Default)]
pub struct Settings {
    #[serde(default)]
    pub config: ConfigInfo,
    #[serde(default)]
    pub postgres: DatabaseSettings,
    #[serde(default)]
    pub scraper: ScraperSettings,
}

impl Settings {
    /// Returns a new Settings instance
    ///
    /// # Errors
    ///
    /// Can return an error if:
    /// 1. Config fails to build
    /// 2. Settings fails to deserialize
    pub fn new() -> anyhow::Result<Self> {
        let source = config::Config::builder()
            .add_source(config::Environment::default().separator("_"))
            .build()?;

        Ok(source.try_deserialize()?)
    }
}
