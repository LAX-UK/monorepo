import { z } from "zod";
import { extractBetterAuthSessionToken } from "../../lib/session-cookie.js";
import { zValidator } from "../../lib/z-validator.js";
import type { UserHono, UserRouteDeps } from "./_shared.js";

const deleteAccountBodySchema = z.object({
  confirmation: z.literal("DELETE MY ACCOUNT"),
});

const sessionIdParamSchema = z.object({
  sessionId: z.string().min(8, "Invalid session id"),
});

export function attachUserSecurityRoutes(r: UserHono, deps: UserRouteDeps): void {
  const { container, requireAuth, requirePasswordStepUp, requireSessionRevokeAuth } = deps;

  r.get("/me/sessions", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    try {
      const rows = await container.sessionRevocation.listForUser(userId);
      const currentToken = extractBetterAuthSessionToken(c.req.header("cookie"));
      const data = rows.map(
        ({ token, ipAddress, userAgent, id, createdAt, expiresAt, lastPasswordAuthAt }) => ({
          id,
          createdAt,
          expiresAt,
          ipAddress,
          userAgent,
          lastPasswordAuthAt,
          isCurrent: currentToken !== null && token === currentToken,
        }),
      );
      return c.json({ data });
    } catch (err) {
      console.error("[users/me/sessions] list failed", {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
      return c.json(
        {
          error: "Could not load sessions",
          code: "sessions_list_failed",
        },
        500,
      );
    }
  });

  r.delete(
    "/me/sessions/:sessionId",
    requireAuth,
    requireSessionRevokeAuth,
    zValidator("param", sessionIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { sessionId } = c.req.valid("param");
      const currentToken = extractBetterAuthSessionToken(c.req.header("cookie"));
      const rows = await container.sessionRevocation.listForUser(userId);
      const current = rows.find((row) => row.token === currentToken);
      if (current?.id === sessionId) {
        return c.json(
          { error: "Use sign out to end this session.", code: "session_cannot_delete_current" },
          400,
        );
      }
      const ok = await container.sessionRevocation.deleteSessionForUser(userId, sessionId);
      if (!ok) return c.json({ error: "Session not found", code: "session_not_found" }, 404);
      void container.authAuditPublisher
        .publish({
          eventType: "auth.session_revoked",
          aggregateId: userId,
          payload: { sessionId },
          actorUserId: userId,
        })
        .catch(() => {});
      return c.body(null, 204);
    },
  );

  r.post("/me/sessions/revoke-all", requireAuth, requireSessionRevokeAuth, async (c) => {
    const userId = c.get("userId") as string;
    const currentToken = extractBetterAuthSessionToken(c.req.header("cookie"));
    if (!currentToken) return c.json({ error: "Unauthorized", code: "session_required" }, 401);
    const sid = await container.sessionRevocation.getSessionIdForCookieToken(userId, currentToken);
    if (!sid) return c.json({ error: "Session not found", code: "session_required" }, 401);
    await container.sessionRevocation.revokeAllForUserExcept(userId, sid);
    void container.authAuditPublisher
      .publish({
        eventType: "auth.sessions_revoked_all_except_current",
        aggregateId: userId,
        payload: {},
        actorUserId: userId,
      })
      .catch(() => {});
    return c.json({ ok: true });
  });

  r.post("/me/security-notify/two-factor-enabled", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const twoFactorEnabled = await container.userSecurityReadService.getTwoFactorEnabled(userId);
    if (!twoFactorEnabled) {
      return c.json(
        { error: "Two-factor authentication is not enabled", code: "two_factor_not_enabled" },
        409,
      );
    }
    const row = await container.userService.getById(userId);
    if (!row) return c.json({ error: "Not found", code: "user_not_found" }, 404);
    void container.emailService.enqueue({
      template: "2fa-enabled",
      to: row.email,
      userId,
      category: "auth",
      vars: { userName: row.name },
    });
    void container.authAuditPublisher
      .publish({
        eventType: "auth.two_factor_security_email",
        aggregateId: userId,
        payload: { kind: "enabled" },
        actorUserId: userId,
      })
      .catch(() => {});
    return c.json({ ok: true });
  });

  r.post("/me/security-notify/two-factor-disabled", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const twoFactorEnabled = await container.userSecurityReadService.getTwoFactorEnabled(userId);
    if (twoFactorEnabled) {
      return c.json(
        { error: "Two-factor authentication is still enabled", code: "two_factor_still_enabled" },
        409,
      );
    }
    const row = await container.userService.getById(userId);
    if (!row) return c.json({ error: "Not found", code: "user_not_found" }, 404);
    void container.emailService.enqueue({
      template: "2fa-disabled",
      to: row.email,
      userId,
      category: "auth",
      vars: { userName: row.name },
    });
    void container.authAuditPublisher
      .publish({
        eventType: "auth.two_factor_security_email",
        aggregateId: userId,
        payload: { kind: "disabled" },
        actorUserId: userId,
      })
      .catch(() => {});
    return c.json({ ok: true });
  });

  r.post(
    "/me/delete",
    requireAuth,
    requirePasswordStepUp,
    zValidator("json", deleteAccountBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const eligibility = await container.accountDeletionEligibilityService.check(userId);
      if (!eligibility.ok) {
        return c.json({ error: eligibility.error, code: eligibility.code }, 409);
      }

      await container.userService.requestAccountDeletion(userId);

      return c.json({ ok: true });
    },
  );
}
