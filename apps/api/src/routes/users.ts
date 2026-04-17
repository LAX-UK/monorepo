import {
  notificationPreferencePatchSchema,
  pushSubscriptionBodySchema,
  pushUnsubscribeBodySchema,
  watchlistBodySchema,
} from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { Container } from "../container.js";
import { defaultNotificationPreference } from "../lib/notification-preference-keys.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import type { NotificationPreferenceInput } from "../services/interfaces/notification-preference.js";

export function createUserRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator);
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();

  r.get("/public/:userId", async (c) => {
    const id = c.req.param("userId");
    const row = await container.userService.getById(id);
    if (!row) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({
      data: { id: row.id, name: row.name, role: row.role },
    });
  });

  r.get("/me/bids", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const data = await container.dashboardQueryService.listBidsWithAuctionsForBidder(userId);
    return c.json({ data });
  });

  r.get("/me/portfolio", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const auctions = await container.auctionService.list({
      winnerId: userId,
      limit: 50,
      offset: 0,
    });
    const payments = await container.paymentService.listForBuyer(userId);
    const byAuction = new Map<string, (typeof payments)[number]>();
    for (const p of payments) {
      if (!byAuction.has(p.auctionId)) byAuction.set(p.auctionId, p);
    }
    const data = auctions.map((auction) => {
      const p = byAuction.get(auction.id);
      return {
        auction,
        payment: p ? { id: p.id, status: p.status } : null,
      };
    });
    return c.json({ data });
  });

  r.get("/me/watchlist", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const data = await container.watchlistService.listWithAuctions(userId);
    return c.json({ data });
  });

  r.post("/me/watchlist", requireAuth, zValidator("json", watchlistBodySchema), async (c) => {
    const userId = c.get("userId") as string;
    const { auctionId } = c.req.valid("json");
    const row = await container.watchlistService.add(userId, auctionId);
    if (!row) {
      return c.json({ error: "Auction not found" }, 404);
    }
    return c.json({ data: row }, 201);
  });

  r.delete("/me/watchlist/:auctionId", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const auctionId = c.req.param("auctionId");
    await container.watchlistService.remove(userId, auctionId);
    return c.body(null, 204);
  });

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

  r.delete("/me/notifications/:notificationId", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const notificationId = c.req.param("notificationId");
    const archived = await container.notificationQueryService.archive(userId, notificationId);
    if (!archived) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.body(null, 204);
  });

  r.patch("/me/notifications/:notificationId/read", requireAuth, async (c) => {
    const userId = c.get("userId") as string;
    const notificationId = c.req.param("notificationId");
    const updated = await container.notificationQueryService.markRead(userId, notificationId);
    if (!updated) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.body(null, 204);
  });

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
    const row = await container.userService.getById(userId);
    if (!row) {
      return c.json({ error: "User not found" }, 404);
    }
    return c.json({ data: { id: row.id, email: row.email, name: row.name, role: row.role } });
  });

  return r;
}
