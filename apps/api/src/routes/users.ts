import {
  legalEntityMember,
  lot,
  payment,
  payout,
  twoFactor,
  user as userTable,
} from "@auction/db/schema";
import {
  addressIdParamSchema,
  artistWatchlistArtistIdParamSchema,
  artistWatchlistBodySchema,
  biddingPreferencesPatchSchema,
  createAddressBodySchema,
  notificationIdUuidParamSchema,
  notificationPreferencePatchSchema,
  pushSubscriptionBodySchema,
  pushUnsubscribeBodySchema,
  registerBodySchema,
  uiPreferencePatchSchema,
  updateAddressBodySchema,
  updateProfileSchema,
  userIdParamSchema,
  watchlistBodySchema,
  watchlistLotIdParamSchema,
  watchlistQuerySchema,
} from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Container } from "../container.js";
import { computeLotCheckoutPricing } from "../lib/lot-checkout-pricing.js";
import { presentLotsImages } from "../lib/media-presenters.js";
import { defaultNotificationPreference } from "../lib/notification-preference-keys.js";
import { extractBetterAuthSessionToken } from "../lib/session-cookie.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { createRequireRecentPasswordAuth } from "../middleware/require-recent-password-auth.js";
import { createTurnstileMiddleware } from "../middleware/turnstile.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { NotificationPreferenceInput } from "../services/interfaces/notification-preference.js";
import type { UpdateAddressInput } from "../services/interfaces/profile.js";

const deleteAccountBodySchema = z.object({
  confirmation: z.literal("DELETE MY ACCOUNT"),
});

const sessionIdParamSchema = z.object({
  sessionId: z.string().min(8, "Invalid session id"),
});

export function createUserRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const requireRecentPasswordAuth = createRequireRecentPasswordAuth(container);
  const requireTurnstile = createTurnstileMiddleware(container.env?.TURNSTILE_SECRET_KEY);
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();

  r.post("/register", zValidator("json", registerBodySchema), requireTurnstile, async (c) => {
    if (container.env?.DISABLE_NEW_USER_REGISTRATION) {
      return c.json(
        { error: "New registrations are temporarily disabled", code: "registration_disabled" },
        503,
      );
    }
    const body = c.req.valid("json");
    const { turnstileToken: _turnstile, ...reg } = body;
    const result = await container.registrationService.register({
      firstName: reg.firstName,
      lastName: reg.lastName,
      email: reg.email,
      password: reg.password,
      persona: reg.persona,
      ...(reg.inviteToken !== undefined ? { inviteToken: reg.inviteToken } : {}),
      ...(reg.mobile !== undefined ? { mobile: reg.mobile } : {}),
    });
    if (!result.ok) {
      return c.json({ error: result.message }, result.status as 400);
    }
    return c.json({ data: { userId: result.userId } }, 201);
  });

  r.get("/public/artists", async (c) => {
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(c.req.query("limit") ?? "24", 10) || 24),
    );
    const offset = Math.max(0, Number.parseInt(c.req.query("offset") ?? "0", 10) || 0);
    const rows = await container.userService.listPublicArtists({ limit, offset });
    const data = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        image: await container.mediaUrlResolver.resolve(row.image),
      })),
    );
    return c.json({ data });
  });

  r.get("/public/:userId", zValidator("param", userIdParamSchema), async (c) => {
    const { userId: id } = c.req.valid("param");
    const row = await container.userService.getById(id);
    if (!row) {
      return c.json({ error: "Not found" }, 404);
    }
    const image = await container.mediaUrlResolver.resolve(row.image);
    return c.json({
      data: { id: row.id, name: row.name, image },
    });
  });

  r.get("/me/bids", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const rows = await container.dashboardQueryService.listBidsWithLotsForBidder(userId);
    const data = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        lot: row.lot ? (await presentLotsImages(container.mediaUrlResolver, [row.lot]))[0] : null,
      })),
    );
    return c.json({ data });
  });

  r.get("/me/portfolio", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const lots = await container.lotService.list({
      winnerId: userId,
      limit: 50,
      offset: 0,
    });
    const payments = await container.paymentService.listForBuyer(userId);
    const byLot = new Map<string, (typeof payments)[number]>();
    for (const p of payments) {
      if (!byLot.has(p.lotId)) byLot.set(p.lotId, p);
    }
    const presentedLots = await presentLotsImages(container.mediaUrlResolver, lots);
    const saleIds = [
      ...new Set(
        presentedLots
          .map((l) => l.saleId)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ];
    const saleRows = await container.saleService.findByIds(saleIds);
    const saleById = new Map(saleRows.map((s) => [s.id, s]));
    const data = presentedLots.map((lotRow) => {
      const p = byLot.get(lotRow.id);
      const sale = lotRow.saleId ? (saleById.get(lotRow.saleId) ?? null) : null;
      return {
        lot: { ...lotRow, checkoutPricing: computeLotCheckoutPricing(lotRow, sale) },
        payment: p ? { id: p.id, status: p.status } : null,
      };
    });
    return c.json({ data });
  });

  r.get("/me/watchlist", requireAuth, zValidator("query", watchlistQuerySchema), async (c) => {
    const userId = c.get("userId") as string;
    const query = c.req.valid("query");
    const rows = await container.watchlistService.listWithLots(userId, {
      sort: query.sort,
      ...(query.status ? { status: query.status } : {}),
      ...(query.categoryIds ? { categoryIds: query.categoryIds } : {}),
    });
    const data = await Promise.all(
      rows.map(async (row) => ({
        ...row,
        lot: row.lot ? (await presentLotsImages(container.mediaUrlResolver, [row.lot]))[0] : null,
      })),
    );
    return c.json({ data });
  });

  r.post("/me/watchlist", requireAuth, zValidator("json", watchlistBodySchema), async (c) => {
    const userId = c.get("userId") as string;
    const { lotId } = c.req.valid("json");
    const row = await container.watchlistService.add(userId, lotId);
    if (!row) {
      return c.json({ error: "Lot not found" }, 404);
    }
    return c.json({ data: row }, 201);
  });

  r.delete(
    "/me/watchlist/:lotId",
    requireAuth,
    zValidator("param", watchlistLotIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { lotId } = c.req.valid("param");
      await container.watchlistService.remove(userId, lotId);
      return c.body(null, 204);
    },
  );

  r.get("/me/artist-watchlist", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const rows = await container.artistWatchlistService.list(userId);
    return c.json({
      data: rows.map((r) => ({ artistId: r.artistId, id: r.id, createdAt: r.createdAt })),
    });
  });

  r.post(
    "/me/artist-watchlist",
    requireAuth,
    zValidator("json", artistWatchlistBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { artistId } = c.req.valid("json");
      const row = await container.artistWatchlistService.add(userId, artistId);
      if (!row) {
        return c.json({ error: "Artist not found" }, 404);
      }
      return c.json({ data: row }, 201);
    },
  );

  r.delete(
    "/me/artist-watchlist/:artistId",
    requireAuth,
    zValidator("param", artistWatchlistArtistIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { artistId } = c.req.valid("param");
      await container.artistWatchlistService.remove(userId, artistId);
      return c.body(null, 204);
    },
  );

  r.patch("/me/profile", requireAuth, zValidator("json", updateProfileSchema), async (c) => {
    const userId = c.get("userId") as string;
    const body = c.req.valid("json");
    await container.profileService.updateProfile(userId, body);
    return c.json({ ok: true });
  });

  r.get("/me/addresses", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const data = await container.addressService.list(userId);
    return c.json({ data });
  });

  r.post("/me/addresses", requireAuth, zValidator("json", createAddressBodySchema), async (c) => {
    const userId = c.get("userId") as string;
    const body = c.req.valid("json");
    const row = await container.addressService.create(userId, body);
    return c.json({ data: row }, 201);
  });

  r.patch(
    "/me/addresses/:id",
    requireAuth,
    zValidator("param", addressIdParamSchema),
    zValidator("json", updateAddressBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const row = await container.addressService.update(userId, id, body as UpdateAddressInput);
      if (!row) return c.json({ error: "Not found" }, 404);
      return c.json({ data: row });
    },
  );

  r.delete(
    "/me/addresses/:id",
    requireAuth,
    zValidator("param", addressIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const ok = await container.addressService.delete(userId, id);
      if (!ok) return c.json({ error: "Not found" }, 404);
      return c.body(null, 204);
    },
  );

  r.post(
    "/me/addresses/:id/default",
    requireAuth,
    zValidator("param", addressIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id } = c.req.valid("param");
      const existing = await container.addressService.list(userId);
      if (!existing.some((a) => a.id === id)) return c.json({ error: "Not found" }, 404);
      await container.addressService.setDefault(userId, id);
      return c.json({ ok: true });
    },
  );

  r.get("/me/notifications", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const rawLimit = c.req.query("limit");
    const parsedLimit = Number.parseInt(rawLimit ?? "20", 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(100, Math.max(1, parsedLimit)) : 20;
    const rawOffset = c.req.query("offset");
    const parsedOffset = Number.parseInt(rawOffset ?? "0", 10);
    const offset =
      Number.isFinite(parsedOffset) && parsedOffset >= 0 ? Math.min(10_000, parsedOffset) : 0;
    const tabRaw = c.req.query("tab") ?? "all";
    const tab = tabRaw === "unread" || tabRaw === "archived" ? tabRaw : "all";
    const typeRaw = c.req.query("type");
    const type = typeRaw && typeRaw.trim() !== "" ? typeRaw.trim() : undefined;
    const data = await container.notificationQueryService.listForUserFiltered(userId, {
      limit,
      offset,
      tab,
      type,
    });
    return c.json({ data });
  });

  const notificationIdsBody = z.object({
    ids: z.array(z.string().min(1)).min(1).max(200),
  });

  r.patch(
    "/me/notifications/read-bulk",
    requireAuth,
    zValidator("json", notificationIdsBody),
    async (c) => {
      const userId = c.get("userId") as string;
      const { ids } = c.req.valid("json");
      const count = await container.notificationQueryService.markManyRead(userId, ids);
      return c.json({ data: { count } });
    },
  );

  r.delete(
    "/me/notifications/:notificationId",
    requireAuth,
    zValidator("param", notificationIdUuidParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { notificationId } = c.req.valid("param");
      const archived = await container.notificationQueryService.archive(userId, notificationId);
      if (!archived) {
        return c.json({ error: "Not found" }, 404);
      }
      return c.body(null, 204);
    },
  );

  r.patch(
    "/me/notifications/:notificationId/read",
    requireAuth,
    zValidator("param", notificationIdUuidParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { notificationId } = c.req.valid("param");
      const updated = await container.notificationQueryService.markRead(userId, notificationId);
      if (!updated) {
        return c.json({ error: "Not found" }, 404);
      }
      return c.body(null, 204);
    },
  );

  r.patch("/me/notifications/read-all", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const count = await container.notificationQueryService.markAllRead(userId);
    return c.json({ data: { count } });
  });

  r.get("/me/push/vapid-key", requireAuth, (c) => {
    return c.json({ data: { publicKey: container.vapidPublicKey } });
  });

  r.get("/me/preferences/notifications", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const row = await container.notificationPreferenceRepository.getForUser(userId);
    const data = row ?? defaultNotificationPreference(userId);
    return c.json({ data });
  });

  r.patch(
    "/me/preferences/notifications",
    requireAuth,
    zValidator("json", notificationPreferencePatchSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const body = c.req.valid("json");
      const data = await container.notificationPreferenceRepository.upsert(
        userId,
        body as NotificationPreferenceInput,
      );
      return c.json({ data });
    },
  );

  r.patch(
    "/me/bidding-preferences",
    requireAuth,
    zValidator("json", biddingPreferencesPatchSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const body = c.req.valid("json");
      const { defaultMaxBidAmount: _clientOnly, ...patch } = body;
      const data = await container.notificationPreferenceRepository.upsert(
        userId,
        patch as NotificationPreferenceInput,
      );
      return c.json({ data });
    },
  );

  r.get("/me/preferences/ui", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const data = await container.uiPreferenceService.getForUser(userId);
    return c.json({ data });
  });

  r.patch(
    "/me/preferences/ui",
    requireAuth,
    zValidator("json", uiPreferencePatchSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const body = c.req.valid("json");
      const data = await container.uiPreferenceService.patch(userId, body);
      return c.json({ data });
    },
  );

  r.post(
    "/me/push-subscription",
    requireAuth,
    zValidator("json", pushSubscriptionBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const body = c.req.valid("json");
      const row = await container.pushSubscriptionRepository.create({
        userId,
        endpoint: body.endpoint,
        p256dh: body.keys.p256dh,
        auth: body.keys.auth,
      });
      return c.json({ data: { id: row.id } }, 201);
    },
  );

  r.post(
    "/me/push-subscription/remove",
    requireAuth,
    zValidator("json", pushUnsubscribeBodySchema),
    async (c) => {
      const body = c.req.valid("json");
      await container.pushSubscriptionRepository.deleteByEndpoint(body.endpoint);
      return c.body(null, 204);
    },
  );

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
    requireRecentPasswordAuth,
    zValidator("param", sessionIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { sessionId } = c.req.valid("param");
      const currentToken = extractBetterAuthSessionToken(c.req.header("cookie"));
      const rows = await container.sessionRevocation.listForUser(userId);
      const current = rows.find((r) => r.token === currentToken);
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

  r.post("/me/sessions/revoke-all", requireAuth, requireRecentPasswordAuth, async (c) => {
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
    // false security emails or spamming the user.
    const [tf] = await container.authDb
      .select({ id: twoFactor.id })
      .from(twoFactor)
      .where(eq(twoFactor.userId, userId))
      .limit(1);
    if (!tf) {
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
    // notification. A row in two_factor means 2FA is still active — reject the call.
    const [tf] = await container.authDb
      .select({ id: twoFactor.id })
      .from(twoFactor)
      .where(eq(twoFactor.userId, userId))
      .limit(1);
    if (tf) {
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
    requireRecentPasswordAuth,
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
      const entityIds = memberRows.map((r) => r.legalEntityId).filter(Boolean);
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

      await container.db
        .update(userTable)
        .set({ deletionRequestedAt: new Date(), updatedAt: new Date() })
        .where(eq(userTable.id, userId));

      return c.json({ ok: true });
    },
  );

  r.get("/me", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const [row, uiPrefs] = await Promise.all([
      container.profileService.getProfile(userId),
      container.uiPreferenceService.getForUser(userId),
    ]);
    if (!row) {
      return c.json({ error: "User not found" }, 404);
    }
    const image = await container.mediaUrlResolver.resolve(row.image);
    return c.json({
      data: {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        staffRole: row.staffRole,
        image,
        emailVerified: row.emailVerified,
        emailStatus: row.emailStatus,
        emailStatusChangedAt: row.emailStatusChangedAt,
        pendingNewEmail: row.pendingNewEmail,
        hasSeenActingContextTooltip: row.hasSeenActingContextTooltip,
        kycStatus: row.kycStatus,
        signupPersona: row.signupPersona,
        deletionRequestedAt: row.deletionRequestedAt,
        twoFactorEnabled: row.twoFactorEnabled,
        uiPreferences: uiPrefs,
      },
    });
  });

  return r;
}
