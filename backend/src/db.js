const { Pool } = require("pg");

// Local DB pool used for auth (users, sessions).
// In production, replace DB_* vars with DATABASE_URL pointing to Supabase
// and consolidate both pools to use the same connection string.
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

module.exports = pool;
