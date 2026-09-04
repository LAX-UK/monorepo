#!/usr/bin/env node
/**
 * Exercises the Bid web BFF OIDC login path end-to-end over HTTP.
 * Fails fast with actionable errors when callback/session/token exchange breaks.
 */
const webBase = (process.env.WEB_ORIGIN ?? "http://localhost:3000").replace(/\/+$/, "");
const authBase = (process.env.AUTH_BASE_URL ?? "http://localhost:3003").replace(/\/+$/, "");
const email = process.env.BID_BFF_TEST_EMAIL ?? process.env.SHOP_OIDC_TEST_EMAIL;
const password = process.env.BID_BFF_TEST_PASSWORD ?? process.env.SHOP_OIDC_TEST_PASSWORD;

if (!email || !password) {
  throw new Error(
    "BID_BFF_TEST_EMAIL and BID_BFF_TEST_PASSWORD (or SHOP_OIDC_* fallbacks) are required",
  );
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

function bidSessionCookieEntry(jar) {
  for (const [name, value] of jar) {
    if (/^(?:__Host-)?lax-bid-session$/.test(name)) return { name, value };
  }
  return null;
}

function assertBidSessionCookie(jar) {
  const entry = bidSessionCookieEntry(jar);
  if (!entry) {
    throw new Error(
      `Bid BFF session cookie missing after callback (cookies: ${[...jar.keys()].join(", ") || "(none)"})`,
    );
  }
  return entry;
}

async function main() {
  const authCookies = new Map();
  const signIn = await fetch(`${authBase}/api/auth/sign-in/email`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/json",
      origin: webBase,
    },
    body: JSON.stringify({ email, password }),
  });
  captureCookies(signIn, authCookies);
  if (!signIn.ok || authCookies.size === 0) {
    throw new Error(`Identity sign-in failed (${signIn.status})`);
  }

  const webCookies = new Map();
  const beginLogin = await fetch(
    `${webBase}/api/auth/login?next=${encodeURIComponent("/dashboard")}`,
    {
      redirect: "manual",
    },
  );
  captureCookies(beginLogin, webCookies);
  const authorizeUrl = beginLogin.headers.get("location");
  if (beginLogin.status !== 302 || !authorizeUrl) {
    throw new Error(`Bid BFF login did not redirect to authorize (${beginLogin.status})`);
  }
  const pendingSession = assertBidSessionCookie(webCookies);

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
    headers: { cookie: cookieHeader(webCookies) },
  });
  captureCookies(callback, webCookies);
  const callbackLocation = callback.headers.get("location") ?? "";
  if (
    (callback.status !== 302 && callback.status !== 303) ||
    !callbackLocation.includes("/dashboard")
  ) {
    throw new Error(
      `Bid BFF callback failed (${callback.status} -> ${callbackLocation || "(no location)"})`,
    );
  }
  const authenticatedSession = assertBidSessionCookie(webCookies);
  if (authenticatedSession.value === pendingSession.value) {
    const setCookies =
      typeof callback.headers.getSetCookie === "function"
        ? callback.headers.getSetCookie()
        : [callback.headers.get("set-cookie")].filter(Boolean);
    throw new Error(
      `Bid BFF session cookie was not rotated after callback (set-cookie: ${setCookies.join(" | ") || "(none)"})`,
    );
  }

  const me = await fetch(`${webBase}/api/auth/me`, {
    headers: { cookie: cookieHeader(webCookies) },
  });
  const profile = await me.json().catch(() => null);
  if (!me.ok || profile?.authenticated !== true) {
    const detail =
      profile && typeof profile === "object" ? JSON.stringify(profile) : `(non-json ${me.status})`;
    throw new Error(`Bid BFF authenticated profile check failed (${me.status}): ${detail}`);
  }

  console.log(`bid web BFF roundtrip passed for ${email}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
