import { viewSessionCookieHeader } from "./view-session-cookie";

const APPROVED_ROOTS = new Set([
  "admin",
  "alerts",
  "artists",
  "auth",
  "bids",
  "categories",
  "email",
  "events",
  "exports",
  "invitations",
  "kyc",
  "legal-entities",
  "lots",
  "marketing",
  "newsletter",
  "organizations",
  "payments",
  "payouts",
  "press",
  "q",
  "sale-alerts",
  "sales",
  "stripe-connect",
  "submissions",
  "time",
  "telephone-bookings",
  "uploads",
  "users",
  "venues",
]);

export const APPROVED_PROXY_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]);
export const UNSAFE_PROXY_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function scopesForProxyMethod(method: string): "bid.read" | "bid.write" {
  return UNSAFE_PROXY_METHODS.has(method.toUpperCase()) ? "bid.write" : "bid.read";
}

/**
 * Read-only sale endpoints the API serves to anonymous visitors (saleroom status, lot page of a
 * sale). A visitor without a signed-in session gets them unauthenticated instead of a 401.
 */
export function isPublicSaleReadPath(method: string, segments: readonly string[]): boolean {
  if (method.toUpperCase() !== "GET" && method.toUpperCase() !== "HEAD") return false;
  if (segments[0] !== "sales" || !segments[1]) return false;
  if (segments.length === 3 && segments[2] === "lots") return true;
  return segments.length === 4 && segments[2] === "saleroom" && segments[3] === "status";
}

export function isApprovedProxyPath(segments: readonly string[]): boolean {
  if (segments.length === 0 || !segments[0] || !APPROVED_ROOTS.has(segments[0])) return false;
  return segments.every(
    (segment) =>
      segment.length > 0 &&
      segment !== "." &&
      segment !== ".." &&
      !segment.includes("/") &&
      !segment.includes("\\"),
  );
}

const REQUEST_HEADERS = new Set([
  "accept",
  "accept-language",
  "content-type",
  "if-match",
  "if-none-match",
  "idempotency-key",
  "x-acting-legal-entity-id",
  "x-legal-entity-id",
  "x-lax-consent-analytics",
  "x-lax-consent-marketing",
  "x-lax-ga4-browser-ids",
  "x-lax-marketing-page-url",
  "x-turnstile-token",
  "x-enquiry-draft",
]);

export function sanitizedProxyRequestHeaders(source: Headers, bearer?: string): Headers {
  const result = new Headers(bearer ? { authorization: `Bearer ${bearer}` } : undefined);
  for (const [name, value] of source) {
    if (REQUEST_HEADERS.has(name.toLowerCase())) result.set(name, value);
  }
  // `cookie` is never in the allow-list above: only the view-as-client session crosses, by name.
  const viewSession = viewSessionCookieHeader(source.get("cookie"));
  if (viewSession) result.set("cookie", viewSession);
  return result;
}

const RESPONSE_HEADERS = new Set([
  "cache-control",
  "content-disposition",
  "content-language",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "last-modified",
  "retry-after",
  "vary",
  "x-request-id",
]);

export function sanitizedProxyResponseHeaders(source: Headers): Headers {
  const result = new Headers();
  for (const [name, value] of source) {
    if (RESPONSE_HEADERS.has(name.toLowerCase())) result.set(name, value);
  }
  return result;
}
