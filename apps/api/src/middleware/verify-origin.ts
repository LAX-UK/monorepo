import { createMiddleware } from "hono/factory";
import { respondOriginBlocked } from "../lib/forbidden-response.js";

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
    if (!origin) {
      await next();
      return;
    }
    const allowed = webOrigins.some((w) => origin === w || origin.startsWith(`${w}/`));
    if (!allowed) {
      return respondOriginBlocked(c);
    }
    await next();
  });
}
