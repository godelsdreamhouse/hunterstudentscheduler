// Author: Alba Muriqi
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./db");
const coursesRouter = require("./routes/courses");
const catalogRouter = require("./routes/catalog");

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === "production";

function isAccountRoutesEnabled(value) {
  return value?.trim().toLowerCase() === "true";
}

const accountRoutesEnabled = isAccountRoutesEnabled(process.env.ENABLE_ACCOUNT_ROUTES);

if (isProduction) {
  app.set("trust proxy", 1);
}

const allowedOrigins = (process.env.CORS_ORIGIN || process.env.PUBLIC_APP_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (!isProduction) return /^http:\/\/localhost:\d+$/.test(origin);
  const normalized = origin.replace(/\/$/, "");
  return allowedOrigins.includes(normalized);
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) return callback(null, true);
      return callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());

if (accountRoutesEnabled) {
  const session = require("express-session");
  const connectPgSimple = require("connect-pg-simple");
  const usersRouter = require("./routes/users");
  const PgSession = connectPgSimple(session);

  app.use(
    session({
      store: new PgSession({
        pool,
        tableName: "session",
        createTableIfMissing: true,
      }),
      name: "sid",
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      },
    })
  );

  app.use("/api/users", usersRouter);
} else {
  app.use("/api/users", (_req, res) => res.status(404).json({ error: "Not found" }));
}
app.use("/api/courses", coursesRouter);
app.use("/api/catalog", catalogRouter);

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = { app, accountRoutesEnabled, isAccountRoutesEnabled };
