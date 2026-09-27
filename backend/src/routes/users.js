// Author: Alba Muriqi
const express = require("express");
const bcrypt = require("bcrypt");
const { randomBytes, timingSafeEqual, createHash } = require("crypto");
const { createRemoteJWKSet } = require("jose");
const { CUNY_TENANT_ID, verifyIdentity } = require("../microsoftIdentity");
const pool = require("../db");
const { DEMO_ACCOUNT_EMAIL, DEMO_AUDIT } = require("../demoAudit");

const router = express.Router();
const SALT_ROUNDS = 12;
const microsoftKeys = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${CUNY_TENANT_ID}/discovery/v2.0/keys`));

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function isValidEmplid(emplid) {
  return /^\d{8}$/.test(String(emplid).trim());
}

function getMicrosoftConfig() {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const tenantId = CUNY_TENANT_ID;
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
    jwks: microsoftKeys,
  };
}

function frontendUrl(path, query = {}) {
  const configuredOrigin = process.env.PUBLIC_APP_ORIGIN;
  const url = new URL(path, configuredOrigin || "http://localhost:5173");
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

async function startUserSession(req, res, emplid) {
  await new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
  req.session.userId = emplid;
  await saveSession(req);
  return res.redirect(frontendUrl("/dashboard"));
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
  const verifier = randomBytes(32).toString("base64url");
  delete req.session.microsoftRegistration;
  req.session.microsoftOAuth = { state, nonce, verifier, createdAt: Date.now() };

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
      code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256",
    }).toString();
    return res.redirect(authorizationUrl.toString());
  } catch (err) {
    console.error("could not start Microsoft sign-in:", err);
    return res.redirect(frontendUrl("/login", { error: "microsoft-unavailable" }));
  }
});

/**
 * Verifies the Microsoft ID token and creates the normal application session.
 * First-time identities are sent to a short profile form to collect the CUNY
 * EMPLID required by the scheduler.
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
    await saveSession(req);
    const tokenResponse = await fetch(config.tokenEndpoint, {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: req.query.code,
        grant_type: "authorization_code",
        redirect_uri: config.redirectUri,
        code_verifier: flow.verifier,
      }),
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || typeof token.id_token !== "string") {
      throw new Error("Microsoft token exchange failed");
    }

    const { email, subject } = await verifyIdentity(token.id_token, config.jwks, config.clientId, flow.nonce);

    const linked = await pool.query(
      "SELECT u.emplid FROM microsoft_identities i JOIN users u ON u.emplid = i.emplid WHERE i.subject = $1 AND i.tenant_id = $2",
      [subject, config.tenantId]
    );
    const user = linked.rows[0];
    if (!user) {
      // Do not link legacy accounts on an email match: email is mutable and
      // those accounts were created without email ownership verification.
      await new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
      req.session.microsoftRegistration = {
        email,
        subject,
        tenantId: config.tenantId,
        createdAt: Date.now(),
      };
      await saveSession(req);
      return res.redirect(frontendUrl("/login", { mode: "complete-microsoft" }));
    }

    return await startUserSession(req, res, user.emplid);
  } catch (err) {
    console.error("Microsoft sign-in failed:", err.code || err.name);
    return res.redirect(frontendUrl("/login", { error: "microsoft-sign-in-failed" }));
  }
});

/**
 * Completes a first-time Microsoft account. The identity was already verified
 * in the callback and is held in the server-side session.
 */
router.post("/oauth/microsoft/register", async (req, res) => {
  const registration = req.session.microsoftRegistration;
  const { emplid, first_name: firstName, last_name: lastName } = req.body;
  if (!registration || Date.now() - registration.createdAt > 10 * 60 * 1000) return res.status(401).json({ error: "Microsoft sign-in is required" });
  if (req.get("origin") !== (process.env.PUBLIC_APP_ORIGIN || "http://localhost:5173")) {
    return res.status(403).json({ error: "Invalid request origin" });
  }
  if (!isValidEmplid(emplid) || typeof firstName !== "string" || typeof lastName !== "string"
    || !firstName.trim() || !lastName.trim() || firstName.length > 100 || lastName.length > 100) {
    return res.status(400).json({ error: "EMPLID must be 8 digits and both names are required" });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const normalizedEmplid = String(emplid).trim();
    const existing = await client.query(
      "SELECT emplid FROM users WHERE email = $1 OR emplid = $2",
      [registration.email, normalizedEmplid]
    );
    if (existing.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "An account already uses this email or EMPLID. Contact the app owner to link it to Microsoft." });
    }

    // The legacy schema requires a password. This random hash is never shown
    // or accepted for login; Microsoft remains the sole authentication method.
    const randomPasswordHash = await bcrypt.hash(randomBytes(32).toString("base64url"), SALT_ROUNDS);
    const created = await client.query(
      "INSERT INTO users (emplid, email, first_name, last_name, password) VALUES ($1, $2, $3, $4, $5) RETURNING emplid",
      [normalizedEmplid, registration.email, firstName.trim(), lastName.trim(), randomPasswordHash]
    );
    await client.query(
      "INSERT INTO microsoft_identities (subject, tenant_id, emplid) VALUES ($1, $2, $3)",
      [registration.subject, registration.tenantId, created.rows[0].emplid]
    );
    await client.query("COMMIT");
    await new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
    delete req.session.microsoftRegistration;
    req.session.userId = created.rows[0].emplid;
    await saveSession(req);
    return res.status(201).json({ message: "Account created" });
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("Microsoft account completion failed:", err);
    if (err?.code === "23505") return res.status(409).json({ error: "That Microsoft account is already linked" });
    return res.status(500).json({ error: "Could not create account" });
  } finally {
    if (client) client.release();
  }
});

/**
 * Signs into the fixed demo account from a private, token-protected test URL.
 * It is unavailable unless DEMO_LOGIN_TOKEN is configured in the web runtime.
 */
router.get("/test-login", async (req, res) => {
  res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  const configuredToken = process.env.DEMO_LOGIN_TOKEN;
  if (!configuredToken || configuredToken.length < 32 || !statesMatch(configuredToken, req.query.token)) {
    return res.status(404).end();
  }

  try {
    const result = await pool.query("SELECT emplid FROM users WHERE email = $1", [DEMO_ACCOUNT_EMAIL]);
    if (!result.rows[0]) return res.status(404).end();
    return await startUserSession(req, res, result.rows[0].emplid);
  } catch (err) {
    console.error("test login failed:", err);
    return res.status(500).json({ error: "Could not start test session" });
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
