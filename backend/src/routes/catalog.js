const express = require("express");
const pool = require("../db");

const router = express.Router();
const TERM_SEASONS = new Set(["SPRING", "SUMMER", "FALL", "WINTER"]);
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_QUERY_LENGTH = 100;

/**
 * Lists catalog terms that currently have scraped class sections.
 *
 * Authentication:
 * - Public. This route only reads published catalog data.
 */
router.get("/terms", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT term_season, term_year
       FROM sections
       GROUP BY term_season, term_year
       ORDER BY term_year DESC, CASE term_season
         WHEN 'WINTER' THEN 4
         WHEN 'FALL' THEN 3
         WHEN 'SUMMER' THEN 2
         WHEN 'SPRING' THEN 1
       END DESC`,
    );
    return res.json({ terms: result.rows });
  } catch (err) {
    console.error("public catalog terms error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Lists distinct course attributes represented in one published catalog term.
 *
 * Authentication:
 * - Public. This route only reads published catalog data.
 */
router.get("/attributes", async (req, res) => {
  const termSeason = typeof req.query.term_season === "string"
    ? req.query.term_season.trim().toUpperCase()
    : "";
  const termYear = Number.parseInt(req.query.term_year, 10);

  if (!TERM_SEASONS.has(termSeason)
      || !Number.isInteger(termYear)
      || termYear < 2000
      || termYear > 2100) {
    return res.status(400).json({ error: "Invalid catalog term" });
  }

  try {
    const result = await pool.query(
      `SELECT DISTINCT attribute
       FROM sections s
       JOIN courses c ON c.course_id = s.course_id
       CROSS JOIN LATERAL unnest(c.catalog_attributes) AS attribute
       WHERE s.term_season = $1 AND s.term_year = $2
       ORDER BY attribute`,
      [termSeason, termYear],
    );
    return res.json({ attributes: result.rows.map((row) => row.attribute) });
  } catch (err) {
    console.error("public catalog attributes error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Searches sections for one Hunter catalog term.
 *
 * Authentication:
 * - Public. This route only reads published catalog data.
 *
 * Query parameters:
 * - `term_season`: SPRING, SUMMER, FALL, or WINTER.
 * - `term_year`: four-digit year.
 * - `q`: optional partial course code, title, instructor, or department.
 * - `limit`: optional page size from 1 to 100 (default 50).
 * - `offset`: optional zero-based result offset (default 0).
 * - `hide_full`: optional strict boolean (default false). When true, excludes
 *   sections with known positive capacity whose enrollment is at or above it.
 *
 * Responses:
 * - `200` with up to 100 normalized sections and their meeting times.
 * - `400` when the term is missing or invalid.
 * - `500` when the database query fails.
 */
router.get("/sections", async (req, res) => {
  const termSeason = typeof req.query.term_season === "string"
    ? req.query.term_season.trim().toUpperCase()
    : "";
  const termYear = Number.parseInt(req.query.term_year, 10);
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const attribute = typeof req.query.attribute === "string" ? req.query.attribute.trim() : "";
  const limit = req.query.limit === undefined
    ? DEFAULT_LIMIT
    : Number.parseInt(req.query.limit, 10);
  const offset = req.query.offset === undefined
    ? 0
    : Number.parseInt(req.query.offset, 10);
  const hideFullParam = req.query.hide_full;
  const hideFull = hideFullParam === undefined || hideFullParam === "false"
    ? false
    : hideFullParam === "true"
      ? true
      : null;

  if (!TERM_SEASONS.has(termSeason)
      || !Number.isInteger(termYear)
      || termYear < 2000
      || termYear > 2100
      || q.length > MAX_QUERY_LENGTH
      || attribute.length > MAX_QUERY_LENGTH
      || !Number.isInteger(limit)
      || limit < 1
      || limit > MAX_LIMIT
      || !Number.isInteger(offset)
      || offset < 0
      || hideFull === null) {
    return res.status(400).json({
      error: "Invalid catalog term, query, filter, or pagination values",
    });
  }

  try {
    const result = await pool.query(
      `SELECT
         s.class_num,
         s.term_season,
         s.term_year,
         s.section_number,
         s.section_component,
         s.group_code,
         s.instructor,
         s.instruction_mode,
         s.max_enrollment,
         s.enrollment,
         s.waitlist_max_enrollment,
         s.waitlist_count,
         s.enrollment_status,
         s.notes,
         c.course_id,
         c.course_code,
         c.course_name,
         c.dep_code,
         c.course_description,
         c.credits,
         c.prerequisites,
         c.corequisites,
         c.catalog_attributes,
         COALESCE(meeting_data.meetings, '[]'::json) AS meetings
       FROM sections s
       JOIN courses c ON c.course_id = s.course_id
       LEFT JOIN LATERAL (
         SELECT json_agg(
           json_build_object(
             'days', sm.day_of_week,
             'start_time', to_char(sm.start_time, 'HH24:MI'),
             'end_time', to_char(sm.end_time, 'HH24:MI'),
             'location', sm.location
           )
           ORDER BY sm.start_time, sm.end_time
         ) AS meetings
         FROM section_meetings sm
         WHERE sm.section_id = s.section_id
       ) meeting_data ON TRUE
       WHERE s.term_season = $1
         AND s.term_year = $2
         AND (
           $3 = ''
           OR c.course_code ILIKE '%' || $3 || '%'
           OR c.course_name ILIKE '%' || $3 || '%'
           OR c.dep_code ILIKE '%' || $3 || '%'
           OR COALESCE(s.instructor, '') ILIKE '%' || $3 || '%'
           OR EXISTS (
             SELECT 1 FROM unnest(c.catalog_attributes) AS catalog_attribute
             WHERE catalog_attribute ILIKE '%' || $3 || '%'
           )
         )
         AND (
           $6 = ''
           OR EXISTS (
             SELECT 1 FROM unnest(c.catalog_attributes) AS catalog_attribute
             WHERE catalog_attribute ILIKE '%' || $6 || '%'
           )
         )
         AND (
           NOT $7::boolean
           OR s.enrollment IS NULL
           OR s.max_enrollment IS NULL
           OR s.max_enrollment <= 0
           OR s.enrollment < s.max_enrollment
         )
       ORDER BY c.course_code, s.section_number, s.class_num
       LIMIT $4
       OFFSET $5`,
      [termSeason, termYear, q, limit + 1, offset, attribute, hideFull],
    );
    const sections = result.rows.slice(0, limit);
    return res.json({
      sections,
      pagination: {
        limit,
        offset,
        has_more: result.rows.length > limit,
      },
    });
  } catch (err) {
    console.error("public catalog sections error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
