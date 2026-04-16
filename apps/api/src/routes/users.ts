import { watchlistBodySchema } from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

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
    const raw = c.req.query("limit");
    const parsed = Number.parseInt(raw ?? "20", 10);
    const limit = Number.isFinite(parsed) ? Math.min(100, Math.max(1, parsed)) : 20;
    const data = await container.notificationQueryService.listForUser(userId, limit);
    return c.json({ data });
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
