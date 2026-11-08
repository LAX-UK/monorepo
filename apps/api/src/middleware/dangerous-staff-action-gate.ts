import {
  canAccessFinanceAdminRoutes,
  canAccessPlatformAdminRoutes,
  normalizeUserRoleOrClient,
} from "@auction/types";
import type { StaffRoles } from "@auction/types";
import { createMiddleware } from "hono/factory";
import { findDangerousStaffAction } from "./dangerous-staff-actions.js";
import { type RequireRecentStaffAuth, markStepUpGuard } from "./require-recent-staff-auth.js";

/**
 * Mounted once on the `/admin` app after authentication. Looks the request up in the registry
 * and, for a dangerous action routed through the gate, runs the recent-sign-in check (403
 * `step_up_required` when stale). Everything else passes untouched.
 *
 * Only people who can reach the admin area at all (platform shell or finance) are asked to sign
 * in again. Non-staff and staff without admin access pass straight through, so the shell or the
 * route answers "forbidden" and Identity is never called for them. The per-route capability check
 * still runs after the gate, so a staff member with admin access but without the specific
 * capability sees a fresh sign-in prompt before "forbidden". The gate never grants anything, it
 * only adds a requirement.
 *
 * `enforce` is a code flag: false turns the gate into a pass-through (routes that already carry
 * their own guard keep it either way).
 */
export function createDangerousStaffActionGate(
  requireRecent: RequireRecentStaffAuth,
  options: { enforce?: boolean } = {},
) {
  const enforce = options.enforce ?? true;
  return markStepUpGuard(
    createMiddleware<{
      Variables: {
        userId?: string;
        userRole?: string;
        userStaffRoles?: StaffRoles | undefined;
        identitySessionId?: string;
        staffStepUpVerified?: true;
      };
    }>(async (c, next) => {
      if (!enforce) return next();
      const action = findDangerousStaffAction(c.req.method, c.req.path);
      if (!action || action.enforcedBy !== "gate") return next();
      const role = normalizeUserRoleOrClient(c.get("userRole"));
      const staff = c.get("userStaffRoles");
      const reachesAdmin =
        canAccessPlatformAdminRoutes(role, staff) || canAccessFinanceAdminRoutes(role, staff);
      if (role !== "staff" || !reachesAdmin) return next();
      return requireRecent(c, next);
    }),
  );
}
