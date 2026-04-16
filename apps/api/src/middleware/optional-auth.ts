import { createMiddleware } from "hono/factory";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

/** Sets userId / userRole when a session cookie is present; otherwise continues anonymously. */
export function createOptionalAuth(authenticator: IAuthenticator) {
  return createMiddleware<{
    Variables: { userId?: string; userRole?: string };
  }>(async (c, next) => {
    const user = await authenticator.getSessionUser(c.req.raw.headers);
    if (user) {
      c.set("userId", user.id);
      c.set("userRole", user.role);
    }
    await next();
  });
}
