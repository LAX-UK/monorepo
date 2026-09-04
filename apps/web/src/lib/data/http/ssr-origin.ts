/** Pure SSR origin derivation (no server-only; safe for unit tests). */

import { isLoopbackHostHeader, normalizeLoopbackOrigin } from "@/lib/bff/loopback-host";

export type HeaderBag = {
  get(name: string): string | null | undefined;
};

/** Derive browser-like Origin for server-side API calls (verify-origin CSRF defense). */
export function deriveSsrOriginFromHeaders(
  bag: HeaderBag,
  envFallback = process.env.NEXT_PUBLIC_WEB_ORIGIN,
): string {
  const direct = bag.get("origin")?.trim();
  if (direct) return normalizeLoopbackOrigin(direct, envFallback);

  const hostHeader =
    bag.get("x-forwarded-host")?.split(",")[0]?.trim() || bag.get("host")?.split(",")[0]?.trim();
  const proto =
    bag.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (hostHeader && isLoopbackHostHeader(hostHeader) ? "http" : "https");
  if (hostHeader) {
    return normalizeLoopbackOrigin(`${proto}://${hostHeader}`, envFallback);
  }

  const fallback = envFallback?.replace(/\/$/, "");
  if (fallback) return fallback;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SSR origin could not be derived. Set NEXT_PUBLIC_WEB_ORIGIN or ensure forwarded Host headers are present.",
    );
  }
  console.warn("[ssr-origin] Could not derive SSR Origin; falling back to http://localhost:3000");
  return "http://localhost:3000";
}
