const express = require("express");
const pool = require("../db");

const router = express.Router();

// GET /api/courses/search?q=
router.get("/search", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) return res.json({ courses: [] });

  try {
    const result = await pool.query(
      `SELECT course_id, course_code, course_name, credits
       FROM courses
       WHERE is_active = TRUE
         AND (course_code ILIKE $1 OR course_name ILIKE $1)
       ORDER BY course_code
       LIMIT 20`,
      [`%${q}%`]
    );
    return res.json({ courses: result.rows });
  } catch (err) {
    console.error("courses search error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
