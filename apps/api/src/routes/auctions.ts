import {
  archiveCountQuerySchema,
  archiveSummaryQuerySchema,
  createAuctionSchema,
  listAuctionsQuerySchema,
} from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { asHttpStatus } from "../lib/http-status.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export function createAuctionRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator);
  const r = new Hono<{ Variables: { userId: string } }>();

  r.get("/", zValidator("query", listAuctionsQuerySchema), async (c) => {
    const query = c.req.valid("query");
    const data = await container.auctionService.list({
      status: query.status,
      categoryId: query.categoryId,
      sellerId: query.sellerId,
      winnerId: query.winnerId,
      endYear: query.endYear,
      sort: query.sort,
      limit: query.limit,
      offset: query.offset,
    });
    return c.json({ data });
  });

  r.get("/archive/summary", zValidator("query", archiveSummaryQuerySchema), async (c) => {
    const q = c.req.valid("query");
    const { total, count } = await container.auctionService.archiveEndedSummary({
      endYear: q.endYear,
    });
    return c.json({
      data: { totalHammer: total, endedLotCount: count },
    });
  });

  r.get("/archive/count", zValidator("query", archiveCountQuerySchema), async (c) => {
    const q = c.req.valid("query");
    const count = await container.auctionService.countMatching({
      status: "ended",
      categoryId: q.categoryId,
      endYear: q.endYear,
    });
    return c.json({ count });
  });

  r.get("/:id/bids", async (c) => {
    const id = c.req.param("id");
    const auction = await container.auctionService.getById(id);
    if (!auction) {
      return c.json({ error: "Not found" }, 404);
    }
    const raw = c.req.query("limit");
    const parsed = Number.parseInt(raw ?? "50", 10);
    const limit = Number.isFinite(parsed) ? Math.min(100, Math.max(1, parsed)) : 50;
    const bids = await container.bidService.listForAuction(id, limit);
    return c.json({ data: bids });
  });

  r.get("/:id", async (c) => {
    const id = c.req.param("id");
    const auction = await container.auctionService.getById(id);
    if (!auction) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ data: auction });
  });

  r.post("/", requireAuth, zValidator("json", createAuctionSchema), async (c) => {
    const userId = c.get("userId");
    const body = c.req.valid("json");
    const result = await container.auctionService.create(userId, body);
    return result.match(
      (auction) => c.json({ data: auction }, 201),
      (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
    );
  });

  return r;
}
