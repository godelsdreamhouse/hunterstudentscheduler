const { Pool } = require("pg");

// Supabase pool used for courses and electives (program_elective_courses view).
// In production, both this pool and db.js should point to the same Supabase
// database via DATABASE_URL — the split only exists for local development.
const connectionString = (process.env.DATABASE_URL ?? "").replace(/[?&]sslmode=[^&]*/g, "");
const remotePool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

remotePool.on("error", (err) => {
  console.error("Supabase pool error:", err);
});

module.exports = remotePool;
