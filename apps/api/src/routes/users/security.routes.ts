import { lotNotDeleted } from "@auction/db";
import { legalEntityMember, lot, payment, payout, user as userTable } from "@auction/db/schema";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
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
        .publish(container.db, {
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
      .publish(container.db, {
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
    // Server-side assertion: verify 2FA is actually enabled in the DB before
    // sending the notification. This prevents a malicious client from triggering
    // false security emails or spamming the user. `user.twoFactorEnabled` is the
    // single source of truth Better Auth flips only once TOTP setup is verified —
    // a `twoFactor` row alone can exist unverified (e.g. abandoned setup wizard).
    const [authUser] = await container.authDb
      .select({ twoFactorEnabled: userTable.twoFactorEnabled })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);
    if (!authUser?.twoFactorEnabled) {
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
      .publish(container.db, {
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
    // Server-side assertion: verify 2FA is actually disabled before sending the
    // notification. `user.twoFactorEnabled` still true means 2FA is still active —
    // reject the call.
    const [authUser] = await container.authDb
      .select({ twoFactorEnabled: userTable.twoFactorEnabled })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);
    if (authUser?.twoFactorEnabled) {
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
      .publish(container.db, {
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
      const [u] = await container.db
        .select({ deletionRequestedAt: userTable.deletionRequestedAt })
        .from(userTable)
        .where(eq(userTable.id, userId))
        .limit(1);
      if (u?.deletionRequestedAt) {
        return c.json(
          { error: "Deletion already requested", code: "account_deletion_already_requested" },
          409,
        );
      }

      const [pendingPayment] = await container.db
        .select({ id: payment.id })
        .from(payment)
        .where(and(eq(payment.buyerId, userId), eq(payment.status, "pending")))
        .limit(1);
      if (pendingPayment) {
        return c.json(
          {
            error: "You have unpaid pending payments; resolve them before deleting your account.",
            code: "account_deletion_pending_payments",
          },
          409,
        );
      }

      const [activeSellerLot] = await container.db
        .select({ id: lot.id })
        .from(lot)
        .innerJoin(
          legalEntityMember,
          and(
            eq(legalEntityMember.legalEntityId, lot.sellerLegalEntityId),
            eq(legalEntityMember.userId, userId),
            isNull(legalEntityMember.removedAt),
            isNotNull(legalEntityMember.acceptedAt),
          ),
        )
        .where(
          and(
            isNotNull(lot.sellerLegalEntityId),
            inArray(lot.status, ["draft", "scheduled", "active"]),
            lotNotDeleted(),
          ),
        )
        .limit(1);
      if (activeSellerLot) {
        return c.json(
          {
            error:
              "You still have active or scheduled lots as a seller; withdraw or complete them first.",
            code: "account_deletion_active_seller_lots",
          },
          409,
        );
      }

      const memberRows = await container.db
        .select({ legalEntityId: legalEntityMember.legalEntityId })
        .from(legalEntityMember)
        .where(and(eq(legalEntityMember.userId, userId), isNull(legalEntityMember.removedAt)));
      const entityIds = memberRows.map((row) => row.legalEntityId).filter(Boolean);
      if (entityIds.length > 0) {
        const [openPayout] = await container.db
          .select({ id: payout.id })
          .from(payout)
          .where(
            and(
              inArray(payout.legalEntityId, entityIds as string[]),
              inArray(payout.status, ["scheduled", "in_transit", "clawback_pending"]),
            ),
          )
          .limit(1);
        if (openPayout) {
          return c.json(
            {
              error: "Your organisation has payouts still in flight; resolve them before deletion.",
              code: "account_deletion_open_payouts",
            },
            409,
          );
        }
      }

      await container.userService.requestAccountDeletion(userId);

      return c.json({ ok: true });
    },
  );
}
