const { Pool } = require("pg");
const fs = require("fs");

const sslRootCert = process.env.POSTGRES_SSLROOTCERT;
const legacyConnectionString = process.env.DATABASE_URL;
const structuredConnection = process.env.POSTGRES_HOST
  ? {
      host: process.env.POSTGRES_HOST,
      port: Number(process.env.POSTGRES_PORT || 5432),
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB,
    }
  : {
      connectionString: (legacyConnectionString || "").replace(/[?&]sslmode=[^&]*/g, ""),
    };

const pool = new Pool({
  ...structuredConnection,
  max: Number(process.env.POSTGRES_POOL_MAX || 3),
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  ssl: sslRootCert
    ? { ca: fs.readFileSync(sslRootCert, "utf8"), rejectUnauthorized: true }
    : (legacyConnectionString ? { rejectUnauthorized: false } : undefined),
});

pool.on("error", (err) => {
  console.error("Postgres pool error:", err);
});

module.exports = pool;
