import { timingSafeEqual } from "node:crypto";
import {
  type ClientIpPolicy,
  SERVER_CLIENT_IP_HEADER,
  SERVER_CLIENT_IP_TOKEN_HEADER,
  UNKNOWN_CLIENT_IP,
  createClientIpPolicy,
  normalizedIp,
  resolveClientIpFromHeaders,
} from "@auction/http-headers/client-ip";
import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";

declare module "hono" {
  interface ContextVariableMap {
    /** The caller's address as resolved by {@link createClientIpMiddleware}. */
    clientIp: string;
  }
}

export type ClientIpSettings = {
  trustedProxyCidrs: readonly string[];
  trustedCloudflareProxyCidrs: readonly string[];
  /** Shared with the web servers; without it `x-lax-client-ip` is never believed. */
  serverClientIpToken?: string | undefined;
};

function tokensMatch(expected: string, presented: string | undefined): boolean {
  if (!presented) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(presented);
  return a.length === b.length && timingSafeEqual(a, b);
}

function peerAddress(c: Context): string | undefined {
  try {
    return getConnInfo(c).remote.address;
  } catch {
    return undefined;
  }
}

/**
 * Resolves the caller's address once per request and stores it as `clientIp`. Rate limits, audit
 * trails and consent records all read that value; nothing else in the API reads forwarding headers.
 * A web server that presents the shared token is believed about its own visitor.
 */
export function createClientIpMiddleware(settings: ClientIpSettings) {
  const policy: ClientIpPolicy = createClientIpPolicy({
    trustedProxyCidrs: settings.trustedProxyCidrs,
    trustedCloudflareProxyCidrs: settings.trustedCloudflareProxyCidrs,
    trustedProxyLabel: "API_TRUSTED_PROXY_CIDRS",
    trustedCloudflareProxyLabel: "API_TRUSTED_CLOUDFLARE_PROXY_CIDRS",
  });
  const token = settings.serverClientIpToken;
  return createMiddleware(async (c, next) => {
    const remoteAddress = peerAddress(c);
    const resolved = resolveClientIpFromHeaders((name) => c.req.header(name), policy, {
      remoteAddress,
    });
    const forwarded =
      token &&
      resolved !== UNKNOWN_CLIENT_IP &&
      policy.isTrustedProxy(remoteAddress ?? "") &&
      tokensMatch(token, c.req.header(SERVER_CLIENT_IP_TOKEN_HEADER))
        ? normalizedIp(c.req.header(SERVER_CLIENT_IP_HEADER))
        : null;
    c.set("clientIp", forwarded ?? resolved);
    await next();
  });
}

/** The caller's address for rate-limit keys; "unknown" when it was not resolved. */
export function clientIpOf(c: Context): string {
  return c.get("clientIp") ?? UNKNOWN_CLIENT_IP;
}

/** The caller's address for audit and consent records; null rather than a placeholder. */
export function clientIpOrNull(c: Context): string | null {
  const ip = clientIpOf(c);
  return ip === UNKNOWN_CLIENT_IP ? null : ip;
}
