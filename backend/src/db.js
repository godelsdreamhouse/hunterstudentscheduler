const { Pool } = require("pg");

// Shared Supabase/PostgreSQL pool used for auth, sessions, and course search.
const connectionString = (process.env.DATABASE_URL ?? "").replace(/[?&]sslmode=[^&]*/g, "");

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  console.error("Postgres pool error:", err);
});

module.exports = pool;
