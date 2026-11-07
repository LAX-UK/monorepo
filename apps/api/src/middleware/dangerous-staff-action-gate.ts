import { createMiddleware } from "hono/factory";
import { findDangerousStaffAction } from "./dangerous-staff-actions.js";
import type { RequireRecentStaffAuth } from "./require-recent-staff-auth.js";

/**
 * Mounted once on the `/admin` app after authentication. Looks the request up in the registry
 * and, for a dangerous action routed through the gate, runs the recent-sign-in check (403
 * `step_up_required` when stale). Everything else passes untouched. The capability check still
 * runs in the route, so a person who may not act sees "forbidden" only after a fresh sign-in;
 * the gate never grants anything, it only adds a requirement.
 *
 * `enforce` is a code flag: false turns the gate into a pass-through (routes that already carry
 * their own guard keep it either way).
 */
export function createDangerousStaffActionGate(
  requireRecent: RequireRecentStaffAuth,
  options: { enforce?: boolean } = {},
) {
  const enforce = options.enforce ?? true;
  return createMiddleware<{
    Variables: { userId?: string; identitySessionId?: string; staffStepUpVerified?: true };
  }>(async (c, next) => {
    if (!enforce) return next();
    const action = findDangerousStaffAction(c.req.method, c.req.path);
    if (!action || action.enforcedBy !== "gate") return next();
    return requireRecent(c, next);
  });
}
