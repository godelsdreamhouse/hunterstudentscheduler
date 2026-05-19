// Author: Alba Muriqi
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const connectPgSimple = require("connect-pg-simple");
const cors = require("cors");
const pool = require("./db");
const usersRouter = require("./routes/users");
const coursesRouter = require("./routes/courses");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: process.env.NODE_ENV === "development"
      ? /^http:\/\/localhost:\d+$/
      : process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(express.json());

// Session backed by PostgreSQL
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
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

app.use("/api/users", usersRouter);
app.use("/api/courses", coursesRouter);

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
