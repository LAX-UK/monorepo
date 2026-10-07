#!/usr/bin/env node
/**
 * Tier-1 smoke: shop-admin must reach auth authorize without invalid_client.
 * No credentials required — follows redirects from the login route.
 */
const shopAdminUrl = (process.env.SHOP_ADMIN_URL ?? "https://test-shop-admin.lax.bid").replace(
  /\/+$/,
  "",
);
const authBaseUrl = (process.env.AUTH_BASE_URL ?? "https://test-auth.lax.bid").replace(/\/+$/, "");

async function follow(url, depth = 0) {
  if (depth > 12) throw new Error(`redirect loop from ${url}`);
  const res = await fetch(url, { redirect: "manual" });
  const contentType = res.headers.get("content-type") ?? "";
  const body = await res.text();
  if (body.includes('"invalid_client"') || body.includes("invalid_client")) {
    throw new Error(`auth rejected lax-shop-admin client while probing ${url}`);
  }
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location");
    if (!location) throw new Error(`missing Location header from ${url}`);
    const next = new URL(location, url).toString();
    return follow(next, depth + 1);
  }
  if (!res.ok && res.status !== 401) {
    throw new Error(`unexpected ${res.status} from ${url}`);
  }
  const onAuth =
    url.startsWith(authBaseUrl) ||
    url.includes("/oauth2/authorize") ||
    (contentType.includes("text/html") && url.startsWith(`${authBaseUrl}/login`));
  if (!onAuth) {
    throw new Error(`expected auth boundary after shop-admin redirect; landed on ${url}`);
  }
}

const entry = `${shopAdminUrl}/api/auth/login?returnTo=${encodeURIComponent("/overview")}`;
await follow(entry);
console.log(`shop-admin OIDC preflight ok (${entry})`);
