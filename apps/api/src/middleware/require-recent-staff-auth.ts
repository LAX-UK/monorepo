import { STAFF_STEP_UP_REQUIRED } from "@auction/identity-contracts";
import { createMiddleware } from "hono/factory";
import { IdentityIssuerClientError } from "../infrastructure/http-identity-issuer.client.js";
import type { IStaffStepUpGuard } from "../services/staff-step-up.service.js";

/**
 * Dangerous staff actions (money, roles, sign-in protection, impersonation) need a recent
 * sign-in. When the Identity session is older than the shared window the caller gets 403
 * `step_up_required`, and the browser sends them through a fresh sign-in before they retry.
 * Mount it after the capability check, so people who may not act get "forbidden", not a prompt.
 */
export function createRequireRecentStaffAuth(guard: IStaffStepUpGuard) {
  return createMiddleware<{
    Variables: { userId?: string; identitySessionId?: string };
  }>(async (c, next) => {
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
        return c.json({ error: "Identity service unavailable", code: "identity_unavailable" }, 503);
      }
      throw error;
    }
    if (!recent) {
      return c.json({ error: "Recent sign-in required", code: STAFF_STEP_UP_REQUIRED }, 403);
    }
    await next();
  });
}

/** The middleware both route files take, so tests and wiring share one type. */
export type RequireRecentStaffAuth = ReturnType<typeof createRequireRecentStaffAuth>;
