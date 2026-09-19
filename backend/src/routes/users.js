// Author: Alba Muriqi
const express = require("express");
const bcrypt = require("bcrypt");
const { randomBytes, timingSafeEqual } = require("crypto");
const { createRemoteJWKSet, jwtVerify } = require("jose");
const pool = require("../db");
const { DEMO_ACCOUNT_EMAIL, DEMO_AUDIT } = require("../demoAudit");

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

function getMicrosoftConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const tenantId = process.env.MICROSOFT_TENANT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI;
  if (!clientId || !tenantId || !clientSecret || !redirectUri) return null;

  return {
    clientId,
    tenantId,
    clientSecret,
    redirectUri,
    issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
    authorizeEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
    tokenEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    jwks: createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`)),
  };
}

function frontendUrl(path, query = {}) {
  const configuredOrigin = process.env.PUBLIC_APP_ORIGIN;
  if (!configuredOrigin) return path;
  const url = new URL(path, configuredOrigin);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

function statesMatch(expected, received) {
  if (typeof expected !== "string" || typeof received !== "string") return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return expectedBuffer.length === receivedBuffer.length
    && timingSafeEqual(expectedBuffer, receivedBuffer);
}

/**
 * Starts Microsoft Entra ID OpenID Connect sign-in. The state and nonce are
 * retained only in the server-side session until the callback returns.
 */
router.get("/oauth/microsoft", async (req, res) => {
  const config = getMicrosoftConfig();
  if (!config) {
    return res.redirect(frontendUrl("/login", { error: "microsoft-not-configured" }));
  }

  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  req.session.microsoftOAuth = { state, nonce, createdAt: Date.now() };

  try {
    await saveSession(req);
    const authorizationUrl = new URL(config.authorizeEndpoint);
    authorizationUrl.search = new URLSearchParams({
      client_id: config.clientId,
      response_type: "code",
      response_mode: "query",
      redirect_uri: config.redirectUri,
      scope: "openid profile email",
      state,
      nonce,
    }).toString();
    return res.redirect(authorizationUrl.toString());
  } catch (err) {
    console.error("could not start Microsoft sign-in:", err);
    return res.redirect(frontendUrl("/login", { error: "microsoft-unavailable" }));
  }
});

/**
 * Verifies the Microsoft ID token, links it to an existing local account by
 * email on first use, then creates the normal application session.
 */
router.get("/oauth/microsoft/callback", async (req, res) => {
  const config = getMicrosoftConfig();
  const flow = req.session.microsoftOAuth;
  delete req.session.microsoftOAuth;

  if (!config || !flow || Date.now() - flow.createdAt > 10 * 60 * 1000
    || !statesMatch(flow.state, req.query.state)) {
    return res.redirect(frontendUrl("/login", { error: "microsoft-sign-in-failed" }));
  }
  if (req.query.error || typeof req.query.code !== "string") {
    return res.redirect(frontendUrl("/login", { error: "microsoft-sign-in-cancelled" }));
  }

  try {
    const tokenResponse = await fetch(config.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: req.query.code,
        grant_type: "authorization_code",
        redirect_uri: config.redirectUri,
      }),
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || typeof token.id_token !== "string") {
      throw new Error("Microsoft token exchange failed");
    }

    const { payload } = await jwtVerify(token.id_token, config.jwks, {
      audience: config.clientId,
      issuer: config.issuer,
      nonce: flow.nonce,
    });
    const email = normalizeEmail(payload.preferred_username || payload.email);
    const subject = typeof payload.sub === "string" ? payload.sub : "";
    if (!isAllowedEmail(email) || !subject || payload.tid !== config.tenantId) {
      return res.redirect(frontendUrl("/login", { error: "microsoft-email-not-allowed" }));
    }

    const linked = await pool.query(
      "SELECT u.emplid FROM microsoft_identities i JOIN users u ON u.emplid = i.emplid WHERE i.subject = $1 AND i.tenant_id = $2",
      [subject, config.tenantId]
    );
    let user = linked.rows[0];
    if (!user) {
      const existing = await pool.query("SELECT emplid FROM users WHERE email = $1", [email]);
      user = existing.rows[0];
      if (!user) {
        return res.redirect(frontendUrl("/login", { error: "microsoft-account-needed" }));
      }
      await pool.query(
        "INSERT INTO microsoft_identities (subject, tenant_id, emplid) VALUES ($1, $2, $3)",
        [subject, config.tenantId, user.emplid]
      );
    }

    req.session.userId = user.emplid;
    await saveSession(req);
    return res.redirect(frontendUrl("/dashboard"));
  } catch (err) {
    console.error("Microsoft sign-in failed:", err);
    return res.redirect(frontendUrl("/login", { error: "microsoft-sign-in-failed" }));
  }
});

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
 * Returns the saved, sanitized audit fixture for the designated demo account.
 * The original DegreeWorks PDF and personally identifying information are not
 * stored in the application or sent to the browser.
 */
router.get("/demo-audit", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const result = await pool.query("SELECT email FROM users WHERE emplid = $1", [req.session.userId]);
    const email = normalizeEmail(result.rows[0]?.email);
    if (email !== DEMO_ACCOUNT_EMAIL) {
      return res.status(404).json({ error: "No saved demo audit" });
    }

    res.set("Cache-Control", "no-store");
    return res.json({ audit: DEMO_AUDIT });
  } catch (err) {
    console.error("demo audit error:", err);
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
