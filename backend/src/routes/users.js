// Author: Alba Muriqi
const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../db");

const router = express.Router();
const SALT_ROUNDS = 12;

// POST /api/users/register
router.post("/register", async (req, res) => {
  const { emplid, email, first_name, last_name, password } = req.body;

  if (!emplid || !email || !first_name || !last_name || !password) {
    return res.status(400).json({ error: "emplid, email, first_name, last_name and password are required" });
  }

  try {
    const existing = await pool.query("SELECT emplid FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await pool.query(
      "INSERT INTO users (emplid, email, first_name, last_name, password) VALUES ($1, $2, $3, $4, $5) RETURNING emplid, first_name, last_name, email",
      [emplid, email, first_name, last_name, hashed]
    );

    const user = result.rows[0];
    req.session.userId = user.emplid;
    return res.status(201).json({ first_name: user.first_name, last_name: user.last_name, email: user.email });
  } catch (err) {
    console.error("signup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/users/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
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