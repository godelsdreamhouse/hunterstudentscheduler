// Microsoft's public OIDC discovery document for login.cuny.edu identifies this tenant.
const CUNY_TENANT_ID = "6f60f0b3-5f06-4e09-9715-989dba8cc7d8";

async function verifyIdentity(idToken, keys, clientId, nonce) {
  const { jwtVerify } = require("jose");
  const { payload } = await jwtVerify(idToken, keys, {
    audience: clientId,
    issuer: `https://login.microsoftonline.com/${CUNY_TENANT_ID}/v2.0`,
    algorithms: ["RS256"],
    requiredClaims: ["exp", "iat", "sub", "tid", "nonce"],
  });
  // jose verifies JWT claims but does not implement OIDC nonce checking.
  if (!nonce || payload.nonce !== nonce || payload.tid !== CUNY_TENANT_ID
    || typeof payload.sub !== "string" || !payload.sub) {
    throw new Error("Invalid Microsoft identity");
  }
  const email = typeof payload.preferred_username === "string"
    ? payload.preferred_username.trim().toLowerCase() : "";
  if (!/^[^@\s]+@login\.cuny\.edu$/.test(email)) {
    throw new Error("A CUNY student identity is required");
  }
  return { email, subject: payload.sub, tenantId: payload.tid };
}

module.exports = { CUNY_TENANT_ID, verifyIdentity };
