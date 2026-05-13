import { createMiddleware } from "hono/factory";

export function createSecurityHeadersMiddleware() {
  return createMiddleware(async (c, next) => {
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (c.req.header("x-forwarded-proto") === "https" || c.req.url.startsWith("https:")) {
      c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    }
    await next();
  });
}
