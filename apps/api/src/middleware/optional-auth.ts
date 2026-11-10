import { hasSessionCredential } from "@auction/auth/session-credential";
import type { StaffRoles } from "@auction/types";
import { createMiddleware } from "hono/factory";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { replaceableRejection } from "./auth-rejection.js";

/**
 * Sets user context when an exact-audience Bearer is present; otherwise continues anonymously.
 * A Bearer that was sent but is replaceable (signing key rotated out, expired) is answered 401
 * with that code instead, so the caller can swap the token rather than silently lose the
 * signed-in view. Any other failed credential stays anonymous.
 */
export function createOptionalAuth(authenticator: IAuthenticator) {
  return createMiddleware<{
    Variables: { userId?: string; userRole?: string; userStaffRoles?: StaffRoles | undefined };
  }>(async (c, next) => {
    if (!hasSessionCredential(c.req.raw.headers)) {
      await next();
      return;
    }
    const user = await authenticator.getSessionUser(c.req.raw.headers);
    if (user) {
      c.set("userId", user.id);
      c.set("userRole", user.role);
      c.set("userStaffRoles", user.staffRoles);
    } else {
      const reason = await replaceableRejection(authenticator, c.req.raw.headers);
      if (reason) return c.json({ error: "Unauthorized", code: reason }, 401);
    }
    await next();
  });
}
