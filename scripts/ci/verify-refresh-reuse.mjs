#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";

const authBase = (process.env.AUTH_BASE_URL ?? "http://localhost:3003").replace(/\/+$/, "");
const email = process.env.REFRESH_TEST_EMAIL;
const password = process.env.REFRESH_TEST_PASSWORD;
const clientId = process.env.REFRESH_TEST_CLIENT_ID ?? "lax-shop-web";
const clientSecret = process.env.REFRESH_TEST_CLIENT_SECRET;
const redirectUri = process.env.REFRESH_TEST_REDIRECT_URI ?? "http://localhost:3010/auth/callback";
const graceMs = Number(process.env.REFRESH_TEST_GRACE_MS ?? 5_000);

if (!email || !password || !clientSecret) {
  throw new Error(
    "REFRESH_TEST_EMAIL, REFRESH_TEST_PASSWORD, and REFRESH_TEST_CLIENT_SECRET required",
  );
}

function captureCookies(response, jar) {
  const values =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
  for (const value of values) {
    const [pair] = value.split(";", 1);
    const separator = pair.indexOf("=");
    if (separator > 0) jar.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}

function cookieHeader(jar) {
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function form(path, values, headers = {}) {
  return fetch(`${authBase}${path}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
    body: new URLSearchParams(values),
  });
}

async function issueAuthorizationCode(cookies, verifier) {
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(16).toString("base64url");
  const authorizeUrl = new URL(`${authBase}/api/auth/oauth2/authorize`);
  authorizeUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid profile email offline_access",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  }).toString();
  const authorize = await fetch(authorizeUrl, {
    redirect: "manual",
    headers: { cookie: cookieHeader(cookies) },
  });
  captureCookies(authorize, cookies);
  const html = await authorize.text();
  const consentCode = html.match(/id="consent-code"[^>]+value="([^"]+)"/)?.[1];
  if (!authorize.ok || !consentCode) throw new Error(`authorize failed (${authorize.status})`);

  const consent = await fetch(`${authBase}/api/auth/oauth2/consent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader(cookies),
      origin: authBase,
    },
    body: JSON.stringify({ accept: true, consent_code: consentCode }),
  });
  const consentBody = await consent.json();
  const callback = new URL(consentBody.redirectURI);
  const code = callback.searchParams.get("code");
  if (!consent.ok || callback.searchParams.get("state") !== state || !code) {
    throw new Error(`consent failed (${consent.status})`);
  }
  return code;
}

async function main() {
  const cookies = new Map();
  const signIn = await fetch(`${authBase}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost:3000" },
    body: JSON.stringify({ email, password }),
  });
  captureCookies(signIn, cookies);
  if (!signIn.ok) throw new Error(`sign-in failed (${signIn.status})`);

  const missingVerifier = randomBytes(32).toString("base64url");
  const missingVerifierCode = await issueAuthorizationCode(cookies, missingVerifier);
  const missingVerifierExchange = await form("/api/auth/oauth2/token", {
    grant_type: "authorization_code",
    code: missingVerifierCode,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });
  if (missingVerifierExchange.ok) {
    throw new Error("authorization code exchange accepted a missing PKCE verifier");
  }

  const mismatchVerifier = randomBytes(32).toString("base64url");
  const mismatchVerifierCode = await issueAuthorizationCode(cookies, mismatchVerifier);
  const mismatchExchange = await form("/api/auth/oauth2/token", {
    grant_type: "authorization_code",
    code: mismatchVerifierCode,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: randomBytes(32).toString("base64url"),
  });
  if (mismatchExchange.ok) {
    throw new Error("authorization code exchange accepted a mismatched PKCE verifier");
  }

  const verifier = randomBytes(32).toString("base64url");
  const code = await issueAuthorizationCode(cookies, verifier);

  const exchange = await form("/api/auth/oauth2/token", {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: verifier,
  });
  const issued = await exchange.json();
  if (!exchange.ok || typeof issued.refresh_token !== "string") {
    throw new Error(`code exchange failed (${exchange.status})`);
  }

  const rotate = () =>
    form("/api/auth/oauth2/token", {
      grant_type: "refresh_token",
      refresh_token: issued.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    });
  const first = await rotate();
  const firstBody = await first.json();
  if (!first.ok || typeof firstBody.refresh_token !== "string") {
    throw new Error(`refresh rotation failed (${first.status})`);
  }
  const graceRetry = await rotate();
  const graceBody = await graceRetry.json();
  if (!graceRetry.ok || graceBody.refresh_token !== firstBody.refresh_token) {
    throw new Error(`refresh retry was not idempotent (${graceRetry.status})`);
  }

  await new Promise((resolve) => setTimeout(resolve, graceMs + 250));
  const replay = await rotate();
  if (replay.status !== 401) throw new Error(`refresh replay was not rejected (${replay.status})`);

  const descendant = await form("/api/auth/oauth2/token", {
    grant_type: "refresh_token",
    refresh_token: firstBody.refresh_token,
    client_id: clientId,
    client_secret: clientSecret,
  });
  if (descendant.ok) throw new Error("descendant refresh token survived family revocation");
  console.log(
    "PKCE rejection, refresh rotation, retry grace, replay detection, and family revocation passed",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
