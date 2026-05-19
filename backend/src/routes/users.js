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

// POST /api/users/register
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

// POST /api/users/login
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

// GET /api/users/profile
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

// POST /api/users/logout
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
