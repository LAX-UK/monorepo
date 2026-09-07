#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";

const authBase = (process.env.AUTH_BASE_URL ?? "http://localhost:3003").replace(/\/+$/, "");
const email = process.env.REFRESH_TEST_EMAIL;
const password = process.env.REFRESH_TEST_PASSWORD;
const clientId = process.env.REFRESH_TEST_CLIENT_ID ?? "lax-shop-web";
const clientSecret = process.env.REFRESH_TEST_CLIENT_SECRET;
const redirectUri = process.env.REFRESH_TEST_REDIRECT_URI ?? "http://localhost:3010/auth/callback";
const browserOrigin = process.env.REFRESH_TEST_ORIGIN ?? new URL(redirectUri).origin;
const requestedScopes =
  process.env.REFRESH_TEST_SCOPES ?? "openid profile email offline_access shop.read shop.write";
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

function readCodeFromRedirectUri(redirectUriValue, state) {
  const callback = new URL(redirectUriValue);
  const code = callback.searchParams.get("code");
  if (callback.searchParams.get("state") !== state || !code) return null;
  return code;
}

async function readAuthorizationCodeFromAuthorizeResponse(authorize, state) {
  if (authorize.status < 200 || authorize.status >= 400) return null;

  const location = authorize.headers.get("location");
  if (location) return readCodeFromRedirectUri(location, state);

  const contentType = authorize.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await authorize.clone().json();
    const redirect =
      typeof body.redirectURI === "string"
        ? body.redirectURI
        : typeof body.url === "string"
          ? body.url
          : null;
    return redirect ? readCodeFromRedirectUri(redirect, state) : null;
  }

  const html = await authorize.text();
  const consentCode = html.match(/id="consent-code"[^>]+value="([^"]+)"/)?.[1];
  return consentCode ? { consentCode } : null;
}

async function issueAuthorizationCode(cookies, verifier) {
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(16).toString("base64url");
  const authorizeUrl = new URL(`${authBase}/api/auth/oauth2/authorize`);
  authorizeUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: requestedScopes,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  }).toString();
  const authorize = await fetch(authorizeUrl, {
    redirect: "manual",
    headers: { cookie: cookieHeader(cookies) },
  });
  captureCookies(authorize, cookies);

  const authorizeResult = await readAuthorizationCodeFromAuthorizeResponse(authorize, state);
  if (typeof authorizeResult === "string") return authorizeResult;
  if (!authorizeResult?.consentCode) throw new Error(`authorize failed (${authorize.status})`);

  const consent = await fetch(`${authBase}/api/auth/oauth2/consent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader(cookies),
      origin: authBase,
    },
    body: JSON.stringify({ accept: true, consent_code: authorizeResult.consentCode }),
  });
  const consentBody = await consent.json();
  const code = readCodeFromRedirectUri(consentBody.redirectURI, state);
  if (!consent.ok || !code) {
    throw new Error(`consent failed (${consent.status})`);
  }
  return code;
}

async function main() {
  const cookies = new Map();
  const signIn = await fetch(`${authBase}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: browserOrigin },
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
  if (typeof issued.access_token !== "string") {
    throw new Error("code exchange did not issue an access token");
  }

  const tokenExchange = (resource, scope) =>
    form("/api/auth/oauth2/token", {
      grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
      subject_token: issued.access_token,
      subject_token_type: "urn:ietf:params:oauth:token-type:access_token",
      requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
      resource,
      scope,
      client_id: clientId,
      client_secret: clientSecret,
    });
  const resourceExchange = await tokenExchange("https://shop.lax.art/api", "shop.read");
  const resourceBody = await resourceExchange.json();
  if (!resourceExchange.ok || typeof resourceBody.access_token !== "string") {
    throw new Error(`valid RFC 8693 exchange failed (${resourceExchange.status})`);
  }
  const resourceClaims = JSON.parse(
    Buffer.from(resourceBody.access_token.split(".")[1] ?? "", "base64url").toString("utf8"),
  );
  const audience = Array.isArray(resourceClaims.aud) ? resourceClaims.aud : [resourceClaims.aud];
  const scopes =
    typeof resourceClaims.scope === "string"
      ? resourceClaims.scope.split(/\s+/).filter(Boolean)
      : [];
  if (!audience.includes("lax-shop-api") || !scopes.includes("shop.read")) {
    throw new Error(`unexpected resource token claims: ${JSON.stringify(resourceClaims)}`);
  }
  const wrongAudience = await tokenExchange("https://api.lax.bid", "shop.read");
  if (wrongAudience.ok) throw new Error("RFC 8693 accepted a resource outside the Shop client");
  const wrongScope = await tokenExchange("https://shop.lax.art/api", "bid.read");
  if (wrongScope.ok) throw new Error("RFC 8693 accepted a scope outside the Shop resource");

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
    "PKCE, RFC 8693 audience/scope, refresh rotation, replay, and family revocation passed",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
