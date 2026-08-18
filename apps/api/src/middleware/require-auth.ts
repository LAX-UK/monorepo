import { createMiddleware } from "hono/factory";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { hasBidScope, requiredBidScope } from "./bid-scope-policy.js";

export type RequireAuthOptions = {
  isSuspended?: (userId: string) => Promise<boolean>;
  /** When true, suspended users may proceed (e.g. `/users/me` for routing). */
  allowSuspended?: boolean;
};

export function createRequireAuth(authenticator: IAuthenticator, opts?: RequireAuthOptions) {
  return createMiddleware<{
    Variables: {
      userId?: string;
      userRole?: string;
      userStaffRole?: string | null;
      identitySessionId?: string;
    };
  }>(async (c, next) => {
    const user = await authenticator.getSessionUser(c.req.raw.headers);
    if (!user) {
      return c.json({ error: "Unauthorized", code: "session_required" }, 401);
    }
    const requiredScope = requiredBidScope(c.req.method);
    if (!hasBidScope(user.scopes ?? [], requiredScope)) {
      return c.json({ error: "Forbidden", code: "insufficient_scope", requiredScope }, 403);
    }
    if (!opts?.allowSuspended && opts?.isSuspended && (await opts.isSuspended(user.id))) {
      return c.json({ error: "Account suspended", code: "account_suspended" }, 403);
    }
    c.set("userId", user.id);
    c.set("userRole", user.role);
    c.set("userStaffRole", user.staffRole ?? null);
    if (user.identitySessionId) c.set("identitySessionId", user.identitySessionId);
    await next();
  });
}
