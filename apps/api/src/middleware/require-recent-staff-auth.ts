import { STAFF_STEP_UP_REQUIRED } from "@auction/identity-contracts";
import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { IdentityIssuerClientError } from "../infrastructure/http-identity-issuer.client.js";
import type { IStaffStepUpGuard } from "../services/staff-step-up.service.js";

/**
 * Marks a middleware as a step-up guard, so the drift test can read a route's handler list and
 * prove that every registry entry marked `enforcedBy: "route"` really carries one.
 */
export const STEP_UP_GUARD = Symbol.for("lax.staffStepUpGuard");

export function markStepUpGuard<T extends object>(handler: T): T {
  Object.defineProperty(handler, STEP_UP_GUARD, { value: true });
  return handler;
}

/**
 * Dangerous staff actions (money, roles, sign-in protection, impersonation) need a recent
 * sign-in. When the Identity session is older than the shared window the caller gets 403
 * `step_up_required`, and the browser sends them through a fresh sign-in before they retry.
 * Mount it after the capability check, so people who may not act get "forbidden", not a prompt.
 */
export function createRequireRecentStaffAuth(guard: IStaffStepUpGuard) {
  return markStepUpGuard(
    createMiddleware<{
      Variables: { userId?: string; identitySessionId?: string; staffStepUpVerified?: true };
    }>(async (c, next) => {
      // The registry gate already verified this request; do not ask Identity a second time.
      if (c.get("staffStepUpVerified") === true) return next();
      const userId = c.get("userId");
      if (!userId) {
        return c.json({ error: "Unauthorized", code: "session_required" }, 401);
      }
      const sessionId = c.get("identitySessionId");
      if (!sessionId) {
        return c.json({ error: "Recent sign-in required", code: STAFF_STEP_UP_REQUIRED }, 403);
      }
      let recent: boolean;
      try {
        recent = await guard.isRecent({ subjectId: userId, sessionId });
      } catch (error) {
        if (
          error instanceof IdentityIssuerClientError &&
          (error.kind === "timeout" ||
            error.kind === "network" ||
            error.kind === "invalid_response" ||
            (error.status !== undefined && error.status >= 500))
        ) {
          return c.json(
            { error: "Identity service unavailable", code: "identity_unavailable" },
            503,
          );
        }
        throw error;
      }
      if (!recent) {
        return c.json({ error: "Recent sign-in required", code: STAFF_STEP_UP_REQUIRED }, 403);
      }
      c.set("staffStepUpVerified", true);
      await next();
    }),
  );
}

/** The middleware both route files take, so tests and wiring share one type. */
export type RequireRecentStaffAuth = ReturnType<typeof createRequireRecentStaffAuth>;

/**
 * Step-up for routes outside `/admin` that staff share with other roles (refunds, lot and sale
 * delete or cancel, exports): non-staff pass straight through, staff need a recent sign-in. The
 * guard is built on first use, so routes that never see staff need no step-up service. Entries in
 * the registry marked `enforcedBy: "route"` must mount this (or the same check) themselves.
 */
export function createStaffOnlyStepUp(getGuard: () => IStaffStepUpGuard): MiddlewareHandler {
  let recent: RequireRecentStaffAuth | null = null;
  return markStepUpGuard<MiddlewareHandler>((c, next) => {
    if (c.get("userRole") !== "staff") return next();
    recent ??= createRequireRecentStaffAuth(getGuard());
    return recent(c, next);
  });
}
