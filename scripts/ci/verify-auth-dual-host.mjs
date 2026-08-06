import assert from "node:assert/strict";

const apiUrl = requiredUrl("API_PUBLIC_URL");
const authUrl = requiredUrl("AUTH_PUBLIC_URL");
const webOrigin = requiredUrl("WEB_ORIGIN");
const email = required("AUTH_PARITY_EMAIL");
const password = required("AUTH_PARITY_PASSWORD");

const [apiDiscovery, authDiscovery, apiJwks, authJwks] = await Promise.all([
  getJson(`${apiUrl}/.well-known/openid-configuration`),
  getJson(`${authUrl}/.well-known/openid-configuration`),
  getJson(`${apiUrl}/.well-known/jwks.json`),
  getJson(`${authUrl}/.well-known/jwks.json`),
]);
assert.deepEqual(apiDiscovery, authDiscovery, "dual-host OIDC discovery differs");
assert.deepEqual(apiJwks, authJwks, "dual-host JWKS differs");

const login = await fetch(`${authUrl}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: webOrigin },
  body: JSON.stringify({ email, password }),
});
assert.equal(login.status, 200, `standalone auth sign-in failed: ${login.status}`);
const cookie = login.headers
  .getSetCookie()
  .map((value) => value.split(";", 1)[0])
  .join("; ");
assert.ok(cookie, "standalone auth sign-in did not issue a session cookie");

const first = await readDualHostSession(cookie);
const refreshed = await readDualHostSession(cookie, "?disableCookieCache=true");
assert.equal(first.auth.user.id, refreshed.auth.user.id, "standalone session refresh changed user");
assert.equal(first.api.user.id, refreshed.api.user.id, "API session refresh changed user");

console.log(`dual-host auth parity OK for issuer ${authDiscovery.issuer}`);

async function readDualHostSession(cookie, query = "") {
  const options = { headers: { cookie, origin: webOrigin } };
  const [authResponse, apiResponse] = await Promise.all([
    fetch(`${authUrl}/api/auth/get-session${query}`, options),
    fetch(`${apiUrl}/api/auth/get-session${query}`, options),
  ]);
  assert.equal(authResponse.status, 200, `standalone session failed: ${authResponse.status}`);
  assert.equal(apiResponse.status, 200, `API session failed: ${apiResponse.status}`);
  for (const response of [authResponse, apiResponse]) {
    assert.match(
      response.headers.get("cache-control") ?? "",
      /\bno-store\b/,
      "auth session response is cacheable",
    );
  }
  const [auth, api] = await Promise.all([authResponse.json(), apiResponse.json()]);
  assert.ok(auth?.user?.id, "standalone session has no user");
  assert.equal(api?.user?.id, auth.user.id, "dual-host sessions resolve different users");
  return { auth, api };
}

async function getJson(url) {
  const response = await fetch(url);
  assert.equal(response.status, 200, `${url} failed: ${response.status}`);
  return response.json();
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function requiredUrl(name) {
  return required(name).replace(/\/+$/, "");
}
