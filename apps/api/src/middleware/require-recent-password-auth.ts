import { AUTH_TIMINGS } from "@auction/auth/server";
import { account, session } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import type { Container } from "../container.js";
import { extractBetterAuthSessionToken } from "../lib/session-cookie.js";

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
  container: Container,
  policy: StepUpPolicy = PASSWORD_REQUIRED_POLICY,
) {
  const maxAgeMs = AUTH_TIMINGS.recentPasswordProofMaxAgeSec * 1000;
  return createMiddleware<{
    Variables: { userId?: string };
  }>(async (c, next) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Unauthorized", code: "session_required" }, 401);
    }
    const token = extractBetterAuthSessionToken(c.req.header("cookie"));
    if (!token) {
      return c.json({ error: "Unauthorized", code: "session_required" }, 401);
    }
    const [row] = await container.authDb
      .select({ lastPasswordAuthAt: session.lastPasswordAuthAt })
      .from(session)
      .where(and(eq(session.userId, userId), eq(session.token, token)))
      .limit(1);
    const last = row?.lastPasswordAuthAt;
    const [cred] = await container.authDb
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
      .limit(1);

    if (!cred) {
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
    if (!last || now - last.getTime() > maxAgeMs) {
      return c.json({ error: "Recent sign-in required", code: "recent_auth_required" }, 403);
    }

    await next();
  });
}
