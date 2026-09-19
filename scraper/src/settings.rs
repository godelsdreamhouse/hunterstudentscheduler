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
    #[serde(default = "DatabaseSettings::default_port")]
    pub port: u16,
    #[serde(default = "DatabaseSettings::default_sslmode")]
    pub sslmode: String,
    pub sslrootcert: Option<String>,
}

impl Default for DatabaseSettings {
    fn default() -> Self {
        Self {
            user: Self::default_user(),
            password: Self::default_password(),
            host: Self::default_host(),
            db: Self::default_db(),
            port: Self::default_port(),
            sslmode: Self::default_sslmode(),
            sslrootcert: None,
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
        "hunterscheduler".to_string()
    }
    const fn default_port() -> u16 {
        5432
    }
    fn default_sslmode() -> String {
        "prefer".to_string()
    }

    /// Builds connection options without interpreting credentials as URL syntax.
    ///
    /// # Errors
    /// Returns an error when POSTGRES_SSLMODE is not a valid PostgreSQL SSL mode.
    pub fn connect_options(
        &self,
        user: &str,
        password: &str,
    ) -> anyhow::Result<sqlx::postgres::PgConnectOptions> {
        let sslmode = self.sslmode.parse().map_err(|_| {
            anyhow::anyhow!(
                "Invalid POSTGRES_SSLMODE; use disable, prefer, require, verify-ca, or verify-full"
            )
        })?;
        let mut options = sqlx::postgres::PgConnectOptions::new_without_pgpass()
            .host(&self.host)
            .port(self.port)
            .database(&self.db)
            .username(user)
            .password(password)
            .ssl_mode(sslmode);
        if let Some(path) = &self.sslrootcert {
            options = options.ssl_root_cert(path);
        }
        Ok(options)
    }
}

#[cfg(test)]
mod tests {
    use super::DatabaseSettings;
    use sqlx::postgres::PgSslMode;

    #[test]
    fn rds_options_preserve_host_and_credentials() -> anyhow::Result<()> {
        let settings = DatabaseSettings {
            host: "example.us-east-1.rds.amazonaws.com".into(),
            port: 5433,
            sslmode: "verify-full".into(),
            sslrootcert: Some("/tmp/rds-ca.pem".into()),
            ..DatabaseSettings::default()
        };
        let options = settings.connect_options("user@name", "p@ss:/?#%word")?;
        assert_eq!(options.get_host(), settings.host);
        assert_eq!(options.get_username(), "user@name");
        assert_eq!(options.get_database(), Some("hunterscheduler"));
        assert_eq!(options.get_port(), 5433);
        assert!(matches!(options.get_ssl_mode(), PgSslMode::VerifyFull));
        Ok(())
    }

    #[test]
    fn invalid_ssl_mode_is_rejected() {
        let settings = DatabaseSettings {
            sslmode: "typo".into(),
            ..DatabaseSettings::default()
        };
        assert!(settings.connect_options("user", "secret").is_err());
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
