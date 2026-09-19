const test = require("node:test");
const assert = require("node:assert/strict");
const { generateKeyPair, SignJWT } = require("jose");
const { CUNY_TENANT_ID, verifyIdentity } = require("../src/microsoftIdentity");

test("Microsoft ID tokens must have a valid signature, audience, CUNY tenant and nonce", async () => {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const clientId = "test-client";
  const nonce = "test-nonce";
  async function token(overrides = {}) {
    return new SignJWT({
      tid: CUNY_TENANT_ID, nonce, preferred_username: "student@login.cuny.edu",
      ...overrides,
    }).setProtectedHeader({ alg: "RS256" })
      .setIssuer(overrides.iss || `https://login.microsoftonline.com/${CUNY_TENANT_ID}/v2.0`)
      .setSubject("stable-subject").setAudience(overrides.aud || clientId)
      .setIssuedAt().setExpirationTime(overrides.exp || "5m").sign(privateKey);
  }
  const valid = await token();
  assert.deepEqual(await verifyIdentity(valid, publicKey, clientId, nonce),
    { email: "student@login.cuny.edu", subject: "stable-subject", tenantId: CUNY_TENANT_ID });
  for (const claims of [
    { nonce: "wrong" }, { tid: "other-tenant" }, { iss: "https://attacker.example" },
    { aud: "another-app" }, { preferred_username: "student@example.com" }, { exp: 1 },
  ]) {
    await assert.rejects(verifyIdentity(await token(claims), publicKey, clientId, nonce));
  }
  const other = await generateKeyPair("RS256");
  await assert.rejects(verifyIdentity(valid, other.publicKey, clientId, nonce));
});

test("routes reject password login, invalid OAuth state and invalid demo links; valid demo login rotates session", async () => {
  const pool = require("../src/db");
  const router = require("../src/routes/users");
  const route = (path, method = "get") => router.stack.find(layer =>
    layer.route?.path === path && layer.route.methods[method])?.route.stack[0].handle;
  assert.equal(route("/login", "post"), undefined);
  assert.equal(route("/register", "post"), undefined);
  const result = () => ({
    statusCode: 200, headers: {},
    status(code) { this.statusCode = code; return this; },
    set(headers) { Object.assign(this.headers, headers); return this; },
    end() {}, json(body) { this.body = body; }, redirect(url) { this.location = url; },
  });
  process.env.PUBLIC_APP_ORIGIN = "https://scheduler.example";
  process.env.DEMO_LOGIN_TOKEN = "a".repeat(48);
  const invalid = result();
  await route("/test-login")({ query: { token: "wrong" } }, invalid);
  assert.equal(invalid.statusCode, 404);
  const stateFailure = result();
  await route("/oauth/microsoft/callback")({
    session: {}, query: { code: "untrusted", state: "wrong" },
  }, stateFailure);
  assert.match(stateFailure.location, /microsoft-sign-in-failed/);
  const originalQuery = pool.query;
  let regenerated = false;
  pool.query = async () => ({ rows: [{ emplid: 12345678 }] });
  const req = {
    query: { token: process.env.DEMO_LOGIN_TOKEN },
    session: {
      regenerate(callback) {
        regenerated = true;
        req.session = { save: callback => callback() };
        callback();
      },
    },
  };
  try {
    const valid = result();
    await route("/test-login")(req, valid);
    assert.equal(regenerated, true);
    assert.equal(req.session.userId, 12345678);
    assert.equal(valid.headers["Cache-Control"], "no-store");
    assert.equal(valid.headers["Referrer-Policy"], "no-referrer");
    assert.equal(valid.location, "https://scheduler.example/dashboard");
  } finally {
    pool.query = originalQuery;
    await pool.end();
  }
});
