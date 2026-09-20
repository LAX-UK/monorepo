import { createMiddleware } from "hono/factory";

/** JSON/API responses — no document execution surface. */
export const AUTH_API_CSP =
  "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

/** Hosted login/consent HTML: self scripts + stylesheet, Google fonts, issuer logo. */
export const AUTH_HOSTED_HTML_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join("; ");

/** Hosted HTML when Turnstile widgets are configured. */
export const AUTH_HOSTED_HTML_CSP_TURNSTILE = [
  "default-src 'none'",
  "script-src 'self' https://challenges.cloudflare.com",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com",
  "img-src 'self'",
  "connect-src 'self' https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
].join("; ");

export function hostedHtmlCsp(turnstileEnabled: boolean): string {
  return turnstileEnabled ? AUTH_HOSTED_HTML_CSP_TURNSTILE : AUTH_HOSTED_HTML_CSP;
}

/** Baseline security headers for the auth issuer. */
export function createSecurityHeadersMiddleware(options?: { turnstileEnabled?: boolean }) {
  const hostedCsp = hostedHtmlCsp(Boolean(options?.turnstileEnabled));
  return createMiddleware(async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    const isHtml = (c.res.headers.get("content-type") ?? "").includes("text/html");
    c.header("Content-Security-Policy", isHtml ? hostedCsp : AUTH_API_CSP);
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (c.req.header("x-forwarded-proto") === "https" || c.req.url.startsWith("https:")) {
      c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }
  });
}
