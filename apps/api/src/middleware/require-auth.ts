import type { StaffRoles } from "@auction/types";
import { createMiddleware } from "hono/factory";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { hasBidScope, requiredBidScope } from "./bid-scope-policy.js";

export type RequireAuthOptions = {
  isSuspended?: (userId: string) => Promise<boolean>;
  /** When true, suspended users may proceed (e.g. `/users/me` for routing). */
  allowSuspended?: boolean;
  /**
   * Scopes that each open the route, replacing the default scope for the HTTP method. Only
   * read-only routes should list one, so a narrow token never reaches anything that writes.
   */
  acceptedScopes?: readonly string[];
};

export function createRequireAuth(authenticator: IAuthenticator, opts?: RequireAuthOptions) {
  return createMiddleware<{
    Variables: {
      userId?: string;
      userRole?: string;
      userStaffRoles?: StaffRoles | undefined;
      identitySessionId?: string;
    };
  }>(async (c, next) => {
    const user = await authenticator.getSessionUser(c.req.raw.headers);
    if (!user) {
      return c.json({ error: "Unauthorized", code: "session_required" }, 401);
    }
    const granted = user.scopes ?? [];
    if (opts?.acceptedScopes) {
      if (!opts.acceptedScopes.some((scope) => granted.includes(scope))) {
        return c.json({ error: "Forbidden", code: "insufficient_scope" }, 403);
      }
    } else {
      const requiredScope = requiredBidScope(c.req.method);
      if (!hasBidScope(granted, requiredScope)) {
        return c.json({ error: "Forbidden", code: "insufficient_scope", requiredScope }, 403);
      }
    }
    if (!opts?.allowSuspended && opts?.isSuspended && (await opts.isSuspended(user.id))) {
      return c.json({ error: "Account suspended", code: "account_suspended" }, 403);
    }
    c.set("userId", user.id);
    c.set("userRole", user.role);
    c.set("userStaffRoles", user.staffRoles);
    if (user.identitySessionId) c.set("identitySessionId", user.identitySessionId);
    await next();
  });
}
