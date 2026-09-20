#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describeRejection } from "./http-diagnostics.mjs";
import { completeAuthorization } from "./oidc-authorize-response.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = join(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    if (process.env[key]?.trim()) continue;
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

const STAGING_SHOP_ORIGIN = "https://test-shop.lax.bid";
const LOCAL_SHOP_IDENTITY_ORIGIN = "http://localhost:3010";
const LOCAL_SHOP_STOREFRONT_ORIGIN = "http://localhost:3020";

const authBase = (process.env.AUTH_BASE_URL ?? "http://localhost:3003").replace(/\/+$/, "");
const configuredShopBase = (
  process.env.SHOP_IDENTITY_BASE_URL ?? LOCAL_SHOP_IDENTITY_ORIGIN
).replace(/\/+$/, "");
const configuredStorefrontBase = (
  process.env.SHOP_STOREFRONT_URL ??
  process.env.LAX_SHOP_STOREFRONT_URL ??
  LOCAL_SHOP_STOREFRONT_ORIGIN
).replace(/\/+$/, "");
const shopBase = authBase.includes("test-auth.lax.bid") ? STAGING_SHOP_ORIGIN : configuredShopBase;
const storefrontBase = authBase.includes("test-auth.lax.bid")
  ? STAGING_SHOP_ORIGIN
  : configuredStorefrontBase;
const email = process.env.SHOP_OIDC_TEST_EMAIL;
const password = process.env.SHOP_OIDC_TEST_PASSWORD;

if (!email || !password) {
  throw new Error("SHOP_OIDC_TEST_EMAIL and SHOP_OIDC_TEST_PASSWORD are required");
}

const allowedShopOrigins = new Set([
  STAGING_SHOP_ORIGIN,
  LOCAL_SHOP_IDENTITY_ORIGIN,
  LOCAL_SHOP_STOREFRONT_ORIGIN,
]);
const allowedStorefrontOrigins = new Set([
  STAGING_SHOP_ORIGIN,
  LOCAL_SHOP_STOREFRONT_ORIGIN,
  new URL(storefrontBase).origin,
]);
const allowedAuthOrigins = new Set([
  authBase,
  "http://localhost:3003",
  "https://test-auth.lax.bid",
]);

function assertTrustedRedirect(url, allowedOrigins, expectedPath, label) {
  const parsed = new URL(url);
  if (!allowedOrigins.has(parsed.origin)) {
    throw new Error(`${label} redirect origin is not trusted: ${parsed.origin}`);
  }
  if (parsed.pathname !== expectedPath) {
    throw new Error(`${label} redirect path is not trusted: ${parsed.pathname}`);
  }
  return parsed;
}

function captureCookies(response, jar) {
  const values =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
  for (const value of values) {
    const pair = value.split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator > 0) jar.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
}

function cookieHeader(jar) {
  return [...jar].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function main() {
  if (!allowedShopOrigins.has(new URL(shopBase).origin)) {
    throw new Error(`Shop origin is not allowed for this probe: ${shopBase}`);
  }

  const authCookies = new Map();
  const signIn = await fetch(`${authBase}/api/auth/sign-in/email`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/json",
      origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    },
    body: JSON.stringify({ email, password }),
  });
  captureCookies(signIn, authCookies);
  if (!signIn.ok || authCookies.size === 0) {
    throw new Error(`Identity sign-in failed: ${await describeRejection(signIn)}`);
  }

  const shopCookies = new Map();
  const login = await fetch(`${shopBase}/login`, { redirect: "manual" });
  captureCookies(login, shopCookies);
  const authorizeUrl = login.headers.get("location");
  if (login.status !== 302 || !authorizeUrl || shopCookies.size === 0) {
    throw new Error(`Shop login did not start OIDC (${login.status})`);
  }
  assertTrustedRedirect(
    authorizeUrl,
    allowedAuthOrigins,
    "/api/auth/oauth2/authorize",
    "Shop login authorize",
  );
  const expectedState = new URL(authorizeUrl).searchParams.get("state") ?? undefined;

  const authorize = await fetch(authorizeUrl, {
    redirect: "manual",
    headers: { cookie: cookieHeader(authCookies) },
  });
  captureCookies(authorize, authCookies);
  const callbackUri = await completeAuthorization({
    authBase,
    authorizeResponse: authorize,
    cookieHeader: cookieHeader(authCookies),
    onResponse: (response) => captureCookies(response, authCookies),
    requireFirstPartySkip: true,
    expectedState,
  });
  assertTrustedRedirect(callbackUri, allowedShopOrigins, "/auth/callback", "Shop OIDC callback");

  const callback = await fetch(callbackUri, {
    redirect: "manual",
    headers: { cookie: cookieHeader(shopCookies) },
  });
  captureCookies(callback, shopCookies);
  const callbackLocation = callback.headers.get("location");
  if (callback.status !== 302 || !callbackLocation) {
    throw new Error(`Shop callback failed (${callback.status})`);
  }
  assertTrustedRedirect(
    callbackLocation.startsWith("http")
      ? callbackLocation
      : new URL(callbackLocation, shopBase).toString(),
    allowedStorefrontOrigins,
    "/account",
    "Shop callback",
  );

  const me = await fetch(`${shopBase}/me`, {
    headers: { cookie: cookieHeader(shopCookies) },
  });
  const profile = await me.json();
  if (!me.ok || profile.authenticated !== true || typeof profile.subject !== "string") {
    throw new Error(`Shop authenticated profile check failed (${me.status})`);
  }

  const logout = await fetch(`${shopBase}/logout`, {
    method: "POST",
    redirect: "manual",
    headers: { cookie: cookieHeader(shopCookies), origin: shopBase },
  });
  captureCookies(logout, shopCookies);
  const endSessionUrl = logout.headers.get("location");
  if (logout.status !== 303 || !endSessionUrl) {
    throw new Error(`Shop logout did not return an OP redirect (${logout.status})`);
  }
  assertTrustedRedirect(
    endSessionUrl,
    allowedAuthOrigins,
    "/api/auth/oauth2/endsession",
    "Shop OP end-session",
  );

  const endSession = await fetch(endSessionUrl, {
    redirect: "manual",
    headers: { cookie: cookieHeader(authCookies) },
  });
  if (endSession.status < 300 || endSession.status >= 400) {
    throw new Error(`Shop OP end-session failed (${endSession.status})`);
  }
  const postLogout = endSession.headers.get("location");
  if (!postLogout) throw new Error("Shop OP end-session omitted its post-logout redirect");
  assertTrustedRedirect(postLogout, allowedStorefrontOrigins, "/", "Shop post-logout");
  const signedOut = await fetch(`${shopBase}/me`, {
    headers: { cookie: cookieHeader(shopCookies) },
  });
  const signedOutBody = await signedOut.json().catch(() => null);
  if (signedOut.ok || signedOutBody?.authenticated !== false) {
    throw new Error(`Shop session remained active after central logout (${signedOut.status})`);
  }

  console.log(`shop OIDC roundtrip and central logout passed for subject ${profile.subject}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
