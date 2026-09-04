/** Shared loopback host checks for BFF redirects and SSR origin derivation. */

export const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

export function isLoopbackHostname(hostname: string): boolean {
  return LOOPBACK_HOSTNAMES.has(hostname.toLowerCase());
}

export function hostnameFromHostHeader(host: string): string {
  return host.split(",")[0]?.trim().split(":")[0]?.toLowerCase() ?? host.toLowerCase();
}

export function isLoopbackHostHeader(host: string): boolean {
  return isLoopbackHostname(hostnameFromHostHeader(host));
}

/**
 * When bind/proxy hosts differ only by loopback name (e.g. 0.0.0.0 vs localhost),
 * prefer the configured canonical origin so cookies and verify-origin stay aligned.
 */
export function normalizeLoopbackOrigin(origin: string, envFallback?: string): string {
  const fallback = envFallback?.replace(/\/$/, "");
  if (!fallback) return origin;
  try {
    const parsed = new URL(origin);
    const canonical = new URL(fallback.endsWith("/") ? fallback : `${fallback}/`);
    if (!isLoopbackHostname(parsed.hostname) || !isLoopbackHostname(canonical.hostname)) {
      return origin;
    }
    if (parsed.protocol !== canonical.protocol || parsed.port !== canonical.port) return origin;
    return canonical.origin;
  } catch {
    return origin;
  }
}
