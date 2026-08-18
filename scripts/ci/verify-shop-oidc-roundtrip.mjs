#!/usr/bin/env node

const authBase = (process.env.AUTH_BASE_URL ?? "http://localhost:3003").replace(/\/+$/, "");
const shopBase = (process.env.SHOP_IDENTITY_BASE_URL ?? "http://localhost:3010").replace(
  /\/+$/,
  "",
);
const email = process.env.SHOP_OIDC_TEST_EMAIL;
const password = process.env.SHOP_OIDC_TEST_PASSWORD;

if (!email || !password) {
  throw new Error("SHOP_OIDC_TEST_EMAIL and SHOP_OIDC_TEST_PASSWORD are required");
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
    throw new Error(`Identity sign-in failed (${signIn.status})`);
  }

  const shopCookies = new Map();
  const login = await fetch(`${shopBase}/login`, { redirect: "manual" });
  captureCookies(login, shopCookies);
  const authorizeUrl = login.headers.get("location");
  if (login.status !== 302 || !authorizeUrl || shopCookies.size === 0) {
    throw new Error(`Shop login did not start OIDC (${login.status})`);
  }

  const authorize = await fetch(authorizeUrl, {
    redirect: "manual",
    headers: { cookie: cookieHeader(authCookies) },
  });
  captureCookies(authorize, authCookies);
  if (!authorize.ok) {
    throw new Error(`OIDC authorize failed (${authorize.status})`);
  }
  const consentHtml = await authorize.text();
  const consentCode = consentHtml.match(/id="consent-code"[^>]+value="([^"]+)"/)?.[1];
  if (!consentCode) throw new Error("OIDC authorize did not render a consent code");

  const consent = await fetch(`${authBase}/api/auth/oauth2/consent`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader(authCookies),
      origin: authBase,
    },
    body: JSON.stringify({ accept: true, consent_code: consentCode }),
  });
  captureCookies(consent, authCookies);
  const consentBody = await consent.json();
  if (!consent.ok || typeof consentBody.redirectURI !== "string") {
    throw new Error(`OIDC consent failed (${consent.status})`);
  }

  const callback = await fetch(consentBody.redirectURI, {
    redirect: "manual",
    headers: { cookie: cookieHeader(shopCookies) },
  });
  captureCookies(callback, shopCookies);
  if (callback.status !== 302 || callback.headers.get("location") !== "/") {
    throw new Error(`Shop callback failed (${callback.status})`);
  }

  const me = await fetch(`${shopBase}/me`, {
    headers: { cookie: cookieHeader(shopCookies) },
  });
  const profile = await me.json();
  if (!me.ok || profile.authenticated !== true || typeof profile.subject !== "string") {
    throw new Error(`Shop authenticated profile check failed (${me.status})`);
  }
  console.log(`shop OIDC roundtrip passed for subject ${profile.subject}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
