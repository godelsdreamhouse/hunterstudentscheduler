// Author: Alba Muriqi
const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../db");

const router = express.Router();
const SALT_ROUNDS = 12;

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function isAllowedEmail(email) {
  return normalizeEmail(email).endsWith("@login.cuny.edu");
}

function isValidEmplid(emplid) {
  return /^\d{8}$/.test(String(emplid).trim());
}

function isStrongPassword(password) {
  return typeof password === "string"
    && password.length >= 8
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

/**
 * Registers a new Hunter College student account and starts an authenticated
 * session.
 *
 * Request body:
 * - `emplid`: eight-digit student identifier.
 * - `email`: `@login.cuny.edu` email address.
 * - `first_name`: student's first name.
 * - `last_name`: student's last name.
 * - `password`: password satisfying the configured complexity requirements.
 *
 * Responses:
 * - `201` with the created user's public profile fields.
 * - `400` for invalid or missing input.
 * - `409` when the email or EMPLID is already registered.
 * - `500` when database or hashing operations fail.
 *
 * Side effects:
 * - Inserts a user record containing a bcrypt-hashed password.
 * - Stores the authenticated user's EMPLID in the server-side session.
 */
router.post("/register", async (req, res) => {
  const { emplid, email, first_name, last_name, password } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!emplid || !email || !first_name || !last_name || !password) {
    return res.status(400).json({ error: "emplid, email, first_name, last_name and password are required" });
  }

  if (!isValidEmplid(emplid)) {
    return res.status(400).json({ error: "emplid must be 8 digits" });
  }

  if (!isAllowedEmail(normalizedEmail)) {
    return res.status(400).json({ error: "Only @login.cuny.edu email addresses are allowed" });
  }

  if (!isStrongPassword(password)) {
    return res.status(400).json({
      error: "password must be at least 8 characters and include uppercase, lowercase, number, and special character",
    });
  }

  try {
    const normalizedEmplid = String(emplid).trim();
    const existing = await pool.query(
      "SELECT emplid, email FROM users WHERE email = $1 OR emplid = $2",
      [normalizedEmail, normalizedEmplid]
    );
    if (existing.rows.length > 0) {
      const existingUser = existing.rows[0];
      if (existingUser.email === normalizedEmail) {
        return res.status(409).json({ error: "Email already in use" });
      }
      return res.status(409).json({ error: "EMPLID already in use" });
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      "INSERT INTO users (emplid, email, first_name, last_name, password) VALUES ($1, $2, $3, $4, $5) RETURNING emplid, first_name, last_name, email",
      [normalizedEmplid, normalizedEmail, first_name.trim(), last_name.trim(), hashed]
    );

    const user = result.rows[0];
    req.session.userId = user.emplid;
    return res.status(201).json({ first_name: user.first_name, last_name: user.last_name, email: user.email });
  } catch (err) {
    console.error("signup error:", err);
    if (err?.code === "23505") {
      return res.status(409).json({ error: "Email or EMPLID already in use" });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Authenticates an existing student account and creates a login session.
 *
 * Request body:
 * - `email`: registered `@login.cuny.edu` email address.
 * - `password`: plaintext password submitted for bcrypt comparison.
 *
 * Responses:
 * - `200` with public user fields when authentication succeeds.
 * - `400` for missing or disallowed input.
 * - `401` for invalid credentials.
 * - `500` for server or database failures.
 *
 * Side effects:
 * - Stores the authenticated user's EMPLID in the server-side session.
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  if (!isAllowedEmail(normalizedEmail)) {
    return res.status(400).json({ error: "Only @login.cuny.edu email addresses are allowed" });
  }

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [normalizedEmail]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    req.session.userId = user.emplid;
    return res.json({ first_name: user.first_name, last_name: user.last_name, email: user.email });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Returns the currently authenticated student's public profile information.
 *
 * Authentication:
 * - Requires an active server-side session containing `userId`.
 *
 * Responses:
 * - `200` with `emplid`, `first_name`, `last_name`, and `email`.
 * - `401` when no authenticated session exists.
 * - `404` when the session refers to a missing user.
 * - `500` for database failures.
 */
router.get("/profile", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const result = await pool.query("SELECT emplid, first_name, last_name, email FROM users WHERE emplid = $1", [
      req.session.userId,
    ]);
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ emplid: user.emplid, first_name: user.first_name, last_name: user.last_name, email: user.email });
  } catch (err) {
    console.error("profile error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Ends the authenticated session and clears the browser session cookie.
 *
 * Responses:
 * - `200` when the session is destroyed.
 * - `500` when the session cannot be destroyed.
 *
 * Side effects:
 * - Removes the server-side session and clears the `sid` cookie.
 */
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("logout error:", err);
      return res.status(500).json({ error: "Could not log out" });
    }
    res.clearCookie("sid");
    return res.json({ message: "Logged out" });
  });
});

module.exports = router;
