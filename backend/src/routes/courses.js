// Author: Alba Muriqi
const express = require("express");
const remotePool = require("../remoteDb");

const router = express.Router();

// map app major codes to the program keys stored in the elective lookup view
const PROGRAM_KEY_MAP = {
  CS: "ComputerScience_ComputerScience",
  "Computer Science": "ComputerScience_ComputerScience",
  MATH: "Mathematics_Mathematics",
  Mathematics: "Mathematics_Mathematics",
  POLSC: "PoliticalScience_None",
  "Political Science": "PoliticalScience_None",
};

// GET /api/courses/search?q=
// search all active courses for specific course pinning
router.get("/search", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (!q) return res.json({ courses: [] });

  try {
    const result = await remotePool.query(
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

// GET /api/courses/electives?q=&program_key=
// search the materialized view for major elective pinning
router.get("/electives", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const rawKey = typeof req.query.program_key === "string" ? req.query.program_key.trim() : "";
  const programKey = PROGRAM_KEY_MAP[rawKey] ?? rawKey;

  if (!q || !programKey) return res.json({ courses: [] });

  try {
    const result = await remotePool.query(
      `SELECT course_code
       FROM program_elective_courses
       WHERE program_key = $1
         AND lower(course_code) LIKE '%' || lower($2) || '%'
       ORDER BY course_code
       LIMIT 20`,
      [programKey, q]
    );
    return res.json({ courses: result.rows });
  } catch (err) {
    console.error("electives search error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
