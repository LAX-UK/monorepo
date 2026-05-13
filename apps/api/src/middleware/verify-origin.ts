import { createMiddleware } from "hono/factory";

/** When VERIFY_ORIGIN=true, mutating browser requests must send Origin/Referer matching WEB_ORIGIN. */
export function createVerifyOriginMiddleware(webOrigins: string[], enabled: boolean) {
  return createMiddleware(async (c, next) => {
    if (!enabled) {
      await next();
      return;
    }
    const method = c.req.method;
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      await next();
      return;
    }
    const path = c.req.path;
    if (
      path.startsWith("/webhooks/") ||
      path.startsWith("/api/auth") ||
      path.startsWith("/health")
    ) {
      await next();
      return;
    }
    const origin = c.req.header("origin") ?? c.req.header("referer");
    const cookie = c.req.header("cookie") ?? "";
    // Match the actual Better Auth session cookie names (with or without __Secure- prefix).
    const hasSessionCookie = /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=/.test(cookie);
    if (!origin && hasSessionCookie) {
      return c.json({ error: "Forbidden" }, 403);
    }
    if (!origin) {
      await next();
      return;
    }
    const allowed = webOrigins.some((w) => origin === w || origin.startsWith(`${w}/`));
    if (!allowed) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  });
}
