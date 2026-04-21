import {
  addressIdParamSchema,
  createAddressBodySchema,
  notificationIdUuidParamSchema,
  notificationPreferencePatchSchema,
  pushSubscriptionBodySchema,
  pushUnsubscribeBodySchema,
  registerBodySchema,
  updateAddressBodySchema,
  updateProfileSchema,
  userIdParamSchema,
  artistWatchlistArtistIdParamSchema,
  artistWatchlistBodySchema,
  watchlistBodySchema,
  watchlistLotIdParamSchema,
} from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { Container } from "../container.js";
import { defaultNotificationPreference } from "../lib/notification-preference-keys.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { NotificationPreferenceInput } from "../services/interfaces/notification-preference.js";
import type { UpdateAddressInput } from "../services/interfaces/profile.js";

export function createUserRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();

  r.post("/register", zValidator("json", registerBodySchema), async (c) => {
    const body = c.req.valid("json");
    const result = await container.registrationService.register({
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      password: body.password,
      ...(body.mobile !== undefined ? { mobile: body.mobile } : {}),
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
    const data = await container.userService.listPublicArtists({ limit, offset });
    return c.json({ data });
  });

  r.get("/public/:userId", zValidator("param", userIdParamSchema), async (c) => {
    const { userId: id } = c.req.valid("param");
    const row = await container.userService.getById(id);
    if (!row) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({
      data: { id: row.id, name: row.name, image: row.image ?? null },
    });
  });

  r.get("/me/bids", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const data = await container.dashboardQueryService.listBidsWithLotsForBidder(userId);
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
    const data = lots.map((lotRow) => {
      const p = byLot.get(lotRow.id);
      return {
        lot: lotRow,
        payment: p ? { id: p.id, status: p.status } : null,
      };
    });
    return c.json({ data });
  });

  r.get("/me/watchlist", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const data = await container.watchlistService.listWithLots(userId);
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
    return c.json({ data: rows.map((r) => ({ artistId: r.artistId, id: r.id, createdAt: r.createdAt })) });
  });

  r.post("/me/artist-watchlist", requireAuth, zValidator("json", artistWatchlistBodySchema), async (c) => {
    const userId = c.get("userId") as string;
    const { artistId } = c.req.valid("json");
    const row = await container.artistWatchlistService.add(userId, artistId);
    if (!row) {
      return c.json({ error: "Artist not found" }, 404);
    }
    return c.json({ data: row }, 201);
  });

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

  r.get("/me", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const row = await container.profileService.getProfile(userId);
    if (!row) {
      return c.json({ error: "User not found" }, 404);
    }
    return c.json({
      data: {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        image: row.image,
      },
    });
  });

  return r;
}
