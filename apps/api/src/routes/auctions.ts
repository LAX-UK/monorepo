import {
  archiveCountQuerySchema,
  archiveSummaryQuerySchema,
  auctionIdParamSchema,
  cancelAuctionBodySchema,
  createAuctionSchema,
  listAuctionsQuerySchema,
  updateAuctionSchema,
} from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { CreateAuctionInput } from "@auction/types";
import type { Container } from "../container.js";
import { asHttpStatus } from "../lib/http-status.js";
import { createOptionalAuth } from "../middleware/optional-auth.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export function createAuctionRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator);
  const optionalAuth = createOptionalAuth(authenticator);
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();

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

  r.post(
    "/:id/publish",
    requireAuth,
    zValidator("param", auctionIdParamSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const role = c.get("userRole") ?? "buyer";
      const { id } = c.req.valid("param");
      const result = await container.auctionService.publish(userId, role, id);
      return result.match(
        (auction) => c.json({ data: auction }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

  r.post(
    "/:id/cancel",
    requireAuth,
    zValidator("param", auctionIdParamSchema),
    zValidator("json", cancelAuctionBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const role = c.get("userRole") ?? "buyer";
      const { id } = c.req.valid("param");
      const result = await container.auctionService.cancel(userId, role, id);
      return result.match(
        (auction) => c.json({ data: auction }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

  r.patch(
    "/:id",
    requireAuth,
    zValidator("param", auctionIdParamSchema),
    zValidator("json", updateAuctionSchema),
    async (c) => {
      const role = c.get("userRole") ?? "buyer";
      const { id } = c.req.valid("param");
      const body = c.req.valid("json") as Partial<CreateAuctionInput>;
      const result = await container.auctionService.update(role, id, body);
      return result.match(
        (auction) => c.json({ data: auction }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

  r.get("/:id/bids", optionalAuth, zValidator("param", auctionIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const auction = await container.auctionService.getById(id);
    if (!auction) {
      return c.json({ error: "Not found" }, 404);
    }
    const raw = c.req.query("limit");
    const parsed = Number.parseInt(raw ?? "50", 10);
    const limit = Number.isFinite(parsed) ? Math.min(100, Math.max(1, parsed)) : 50;

    const role = c.get("userRole");
    if (auction.auctionType === "sealed" && auction.status === "active") {
      if (role !== "admin") {
        return c.json({ data: [] });
      }
    }

    const bids = await container.bidService.listForAuction(id, limit);
    return c.json({ data: bids });
  });

  r.get("/:id", zValidator("param", auctionIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const auction = await container.auctionService.getById(id);
    if (!auction) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ data: auction });
  });

  r.post("/", requireAuth, zValidator("json", createAuctionSchema), async (c) => {
    const role = c.get("userRole") ?? "buyer";
    if (role !== "admin") {
      return c.json({ error: "Only admins can create auctions" }, 403);
    }
    const userId = c.get("userId") as string;
    const body = c.req.valid("json");
    const result = await container.auctionService.create(userId, body);
    return result.match(
      (auction) => c.json({ data: auction }, 201),
      (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
    );
  });

  return r;
}
