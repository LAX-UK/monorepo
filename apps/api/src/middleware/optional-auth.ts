import { hasSessionCredential } from "@auction/auth/session-credential";
import { createMiddleware } from "hono/factory";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

/** Sets user context when an exact-audience Bearer is present; otherwise continues anonymously. */
export function createOptionalAuth(authenticator: IAuthenticator) {
  return createMiddleware<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>(async (c, next) => {
    if (!hasSessionCredential(c.req.raw.headers)) {
      await next();
      return;
    }
    const user = await authenticator.getSessionUser(c.req.raw.headers);
    if (user) {
      c.set("userId", user.id);
      c.set("userRole", user.role);
      c.set("userStaffRole", user.staffRole ?? null);
    }
    await next();
  });
}
