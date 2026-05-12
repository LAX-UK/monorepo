import { createMiddleware } from "hono/factory";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export type RequireAuthOptions = {
  isSuspended?: (userId: string) => Promise<boolean>;
};

export function createRequireAuth(authenticator: IAuthenticator, opts?: RequireAuthOptions) {
  return createMiddleware<{
    Variables: { userId?: string; userRole?: string; userStaffRole?: string | null };
  }>(async (c, next) => {
    const user = await authenticator.getSessionUser(c.req.raw.headers);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    if (opts?.isSuspended && (await opts.isSuspended(user.id))) {
      return c.json({ error: "Account suspended" }, 403);
    }
    c.set("userId", user.id);
    c.set("userRole", user.role);
    c.set("userStaffRole", user.staffRole ?? null);
    await next();
  });
}
