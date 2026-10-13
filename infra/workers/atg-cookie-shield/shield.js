// Cloudflare Worker in front of the ATG White Label (auctions.lax.bid).
//
// Production LAX cookies are scoped to `.lax.bid`, so browsers send them to every subdomain,
// including this one, which ATG hosts. This Worker removes LAX cookies before the request leaves
// Cloudflare and makes every cookie ATG sets host-only, so ATG can neither read LAX sessions nor
// plant cookies on lax.bid / auth.lax.bid / api.lax.bid.
//
// It must fail closed: never call `ctx.passThroughOnException()`, which would forward the original
// request, cookies included, when the Worker throws. Only the default export is allowed; Workers
// treat named exports as entrypoints.

// Every LAX cookie set on `.lax.bid` must match this (see auction docs/integrations/atg.md).
const LAX_COOKIE_NAME = /^(?:__Secure-|__Host-)?(?:better-auth[.-]|lax[_-]|_lax_)/i;
const SHIELD_HEADER = "x-lax-cookie-shield";

function isLaxCookieName(name) {
  return LAX_COOKIE_NAME.test(name.trim());
}

/** The Cookie header without LAX cookies, or null when nothing is left. */
function filterCookieHeader(header) {
  if (!header) return null;
  const kept = header
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => pair !== "" && !isLaxCookieName(pair.split("=", 1)[0]));
  return kept.length > 0 ? kept.join("; ") : null;
}

/** The Set-Cookie value made host-only (no Domain), or null when it would set a LAX-named cookie. */
function sanitizeSetCookie(value) {
  const [pair, ...attributes] = value.split(";");
  if (isLaxCookieName(pair.split("=", 1)[0])) return null;
  const kept = attributes.filter(
    (attribute) => attribute.split("=", 1)[0].trim().toLowerCase() !== "domain",
  );
  return [pair.trim(), ...kept.map((attribute) => attribute.trim())].join("; ");
}

function setCookieValues(headers) {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  return headers.getAll("Set-Cookie");
}

async function shieldedFetch(request) {
  const headers = new Headers(request.headers);
  const cookie = filterCookieHeader(headers.get("Cookie"));
  if (cookie) headers.set("Cookie", cookie);
  else headers.delete("Cookie");

  const upstream = await fetch(new Request(request, { headers }));

  const setCookies = setCookieValues(upstream.headers);
  if (upstream.status === 101 && setCookies.length === 0) return upstream;

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("Set-Cookie");
  for (const value of setCookies) {
    const sanitized = sanitizeSetCookie(value);
    if (sanitized) responseHeaders.append("Set-Cookie", sanitized);
  }
  responseHeaders.set(SHIELD_HEADER, "1");

  if (upstream.status === 101) {
    return new Response(null, {
      status: 101,
      webSocket: upstream.webSocket,
      headers: responseHeaders,
    });
  }
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export default {
  async fetch(request) {
    try {
      return await shieldedFetch(request);
    } catch {
      return new Response("The auction site is temporarily unavailable.", {
        status: 502,
        headers: { "content-type": "text/plain; charset=utf-8", [SHIELD_HEADER]: "1" },
      });
    }
  },
};
