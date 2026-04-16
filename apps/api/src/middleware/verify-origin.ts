import { createMiddleware } from "hono/factory";

/** When VERIFY_ORIGIN=true, mutating browser requests must send Origin/Referer matching WEB_ORIGIN. */
export function createVerifyOriginMiddleware(webOrigin: string, enabled: boolean) {
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
    if (path.startsWith("/webhooks/") || path.startsWith("/api/auth")) {
      await next();
      return;
    }
    const origin = c.req.header("origin") ?? c.req.header("referer");
    if (!origin) {
      await next();
      return;
    }
    if (!(origin === webOrigin || origin.startsWith(`${webOrigin}/`))) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  });
}
