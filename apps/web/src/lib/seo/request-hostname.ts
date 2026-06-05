import type { HeaderBag } from "@/lib/data/http/ssr-origin";

/**
 * Resolve the public-facing hostname for a request.
 *
 * Behind Cloudflare / DigitalOcean App Platform, `request.nextUrl.hostname`
 * reflects the internal origin host, not the public domain. The real host is
 * carried in forwarded headers, so prefer those (matching the precedence used
 * by {@link deriveSsrOriginFromHeaders}) before falling back.
 */
export function resolveRequestHostname(headers: HeaderBag, fallback = ""): string {
  const forwarded = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;

  const host = headers.get("host")?.split(",")[0]?.trim();
  if (host) return host;

  return fallback;
}
