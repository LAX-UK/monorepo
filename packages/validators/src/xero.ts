import { z } from "zod";

export const xeroOAuthCompleteBodySchema = z.object({
  state: z.string().min(1),
  /** Full URL the user landed on (origin + path + query), used by the Xero SDK token exchange. */
  callbackUrl: z.string().url(),
});

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname);
}

function originsMatchForCallback(a: URL, b: URL): boolean {
  if (a.origin === b.origin) return true;
  if (!isLoopbackHost(a.hostname) || !isLoopbackHost(b.hostname)) return false;
  return a.protocol === b.protocol && a.port === b.port;
}

/** Ensure the browser-reported callback matches the configured redirect URI (path + origin). */
export function isXeroCallbackUrlAllowed(callbackUrl: string, allowedRedirect: string): boolean {
  let a: URL;
  let b: URL;
  try {
    a = new URL(callbackUrl);
    b = new URL(allowedRedirect);
  } catch {
    return false;
  }
  return originsMatchForCallback(a, b) && a.pathname === b.pathname;
}

/**
 * Build the callback URL Xero expects for token exchange: configured redirect origin/path
 * plus the query string from the incoming request. The browser-reported origin is ignored
 * so reverse-proxy internal hosts (e.g. 0.0.0.0) do not break production OAuth.
 */
export function canonicalizeXeroCallbackUrl(
  callbackUrl: string,
  allowedRedirect: string,
): string | null {
  let incoming: URL;
  let allowed: URL;
  try {
    incoming = new URL(callbackUrl);
    allowed = new URL(allowedRedirect);
  } catch {
    return null;
  }
  if (incoming.pathname !== allowed.pathname) return null;
  return `${allowed.origin}${allowed.pathname}${incoming.search}`;
}

/** Rebuild a callback URL on the canonical site origin (path + query preserved). */
export function normalizeXeroCallbackUrl(callbackUrl: string, canonicalSiteUrl: string): string {
  const incoming = new URL(callbackUrl);
  const site = new URL(canonicalSiteUrl.endsWith("/") ? canonicalSiteUrl : `${canonicalSiteUrl}/`);
  return new URL(`${incoming.pathname}${incoming.search}`, site.origin).toString();
}
