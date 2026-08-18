import { AUTH_TIMINGS } from "@auction/auth/timings";
import { createMiddleware } from "hono/factory";
import type { ContainerPasswordStepUpSlice } from "../container/container-slices.js";
import { IdentityIssuerClientError } from "../infrastructure/http-identity-issuer.client.js";

/**
 * How to treat users who have no password-backed `credential` account row.
 */
export type StepUpPolicy = {
  onMissingCredential: "block" | "allow";
};

/** Default: OAuth-only users must add a password before step-up-gated actions. */
export const PASSWORD_REQUIRED_POLICY: StepUpPolicy = { onMissingCredential: "block" };

/** Session revoke: valid session cookie is sufficient for OAuth-only users. */
export const SESSION_REVOKE_POLICY: StepUpPolicy = { onMissingCredential: "allow" };

/**
 * Requires a fresh proof of identity before sensitive actions (email change, account deletion, etc.).
 *
 * - **Credential users** (have a password): must have used `POST /auth/reauth` within
 *   `AUTH_TIMINGS.recentPasswordProofMaxAgeSec` seconds — checked via `session.last_password_auth_at`.
 * - **OAuth-only users** (no password): behaviour depends on {@link StepUpPolicy}:
 *   - `onMissingCredential: "block"` — reject with `credential_required` (default for destructive flows).
 *   - `onMissingCredential: "allow"` — allow the request (used for revoking other sessions when the
 *     current session is already authenticated).
 */
export function createRequireRecentPasswordAuth(
  container: ContainerPasswordStepUpSlice,
  policy: StepUpPolicy = PASSWORD_REQUIRED_POLICY,
) {
  const maxAgeMs = AUTH_TIMINGS.recentPasswordProofMaxAgeSec * 1000;
  return createMiddleware<{
    Variables: { userId?: string; identitySessionId?: string };
  }>(async (c, next) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Unauthorized", code: "session_required" }, 401);
    }
    const identitySessionId = c.get("identitySessionId");
    if (!identitySessionId) {
      return c.json({ error: "Unauthorized", code: "session_required" }, 401);
    }
    let status: Awaited<ReturnType<typeof container.identityIssuer.stepUpStatus>>;
    try {
      status = await container.identityIssuer.stepUpStatus({
        subjectId: userId,
        sessionToken: identitySessionId,
      });
    } catch (error) {
      if (
        error instanceof IdentityIssuerClientError &&
        (error.code === "no_session" || error.status === 401)
      ) {
        return c.json({ error: "Unauthorized", code: "session_required" }, 401);
      }
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

    if (!status.hasCredential) {
      if (policy.onMissingCredential === "allow") {
        await next();
        return;
      }
      return c.json(
        { error: "A password is required for this action", code: "credential_required" },
        403,
      );
    }

    const now = Date.now();
    if (!status.lastPasswordAuthAt || now - status.lastPasswordAuthAt.getTime() > maxAgeMs) {
      return c.json({ error: "Recent sign-in required", code: "recent_auth_required" }, 403);
    }

    await next();
  });
}
