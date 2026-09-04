const APPROVED_ROOTS = new Set([
  "admin",
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
  "sales",
  "stripe-connect",
  "submissions",
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
]);

export function sanitizedProxyRequestHeaders(source: Headers, bearer?: string): Headers {
  const result = new Headers(bearer ? { authorization: `Bearer ${bearer}` } : undefined);
  for (const [name, value] of source) {
    if (REQUEST_HEADERS.has(name.toLowerCase())) result.set(name, value);
  }
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
