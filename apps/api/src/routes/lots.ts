import { createHash } from "node:crypto";
import { type CreateLotInput, type UserRole, roleHasCapability } from "@auction/types";
import {
  archiveCountQuerySchema,
  archiveSummaryQuerySchema,
  bulkLotsBodySchema,
  cancelLotBodySchema,
  createLotSchema,
  listLotsQuerySchema,
  lotIdParamSchema,
  updateLotMarketingDetailsSchema,
  updateLotSchema,
} from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import type { Context } from "hono";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { type AuthzError, LotError } from "../lib/errors.js";
import { asHttpStatus } from "../lib/http-status.js";
import { maskLotForPublicView } from "../lib/lot-public-view.js";
import { presentLotImages, presentLotsImages } from "../lib/media-presenters.js";
import { createOptionalAuth } from "../middleware/optional-auth.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export function createLotRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const optionalAuth = createOptionalAuth(authenticator);
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();

  function jsonLotOrAuthzError(c: Context, e: LotError | AuthzError) {
    if (e instanceof LotError && e.code) {
      return c.json({ error: e.message, code: e.code }, asHttpStatus(e.status));
    }
    return c.json({ error: e.message }, asHttpStatus(e.status));
  }

  function bidderRef(lotId: string, userId: string): string {
    return createHash("sha256").update(`${lotId}:${userId}`).digest("hex").slice(0, 16);
  }

  r.get("/", optionalAuth, zValidator("query", listLotsQuerySchema), async (c) => {
    const query = c.req.valid("query");
    const role = c.get("userRole");
    const data = await container.lotService.list({
      status: query.status,
      categoryId: query.categoryId,
      categoryIds: query.categoryIds,
      sellerLegalEntityId: query.sellerId,
      winnerId: query.winnerId,
      saleId: query.saleId,
      artistId: query.artistId,
      endYear: query.endYear,
      search: query.q,
      sort: query.sort,
      limit: query.limit,
      offset: query.offset,
    });
    const presented = await presentLotsImages(container.mediaUrlResolver, data);
    return c.json({ data: presented.map((lotRow) => maskLotForPublicView(lotRow, role)) });
  });

  r.post("/bulk", requireAuth, zValidator("json", bulkLotsBodySchema), async (c) => {
    const userId = c.get("userId") as string;
    const role = (c.get("userRole") ?? "client") as UserRole;
    if (!roleHasCapability(role, "auction.manage")) {
      return c.json({ error: "Forbidden" }, 403);
    }
    const { ids, op } = c.req.valid("json");
    const errors: string[] = [];
    for (const id of ids) {
      if (op === "publish") {
        const res = await container.lotService.publish(userId, role, id);
        if (res.isErr()) errors.push(`${id}: ${res.error.message}`);
      } else {
        const res = await container.lotService.cancel(userId, role, id);
        if (res.isErr()) errors.push(`${id}: ${res.error.message}`);
      }
    }
    return c.json({
      data: { attempted: ids.length, failed: errors.length, errors },
    });
  });

  r.get("/archive/summary", zValidator("query", archiveSummaryQuerySchema), async (c) => {
    const q = c.req.valid("query");
    const { total, count } = await container.lotService.archiveEndedSummary({
      endYear: q.endYear,
    });
    return c.json({
      data: { totalHammer: total, endedLotCount: count },
    });
  });

  r.get("/archive/count", zValidator("query", archiveCountQuerySchema), async (c) => {
    const q = c.req.valid("query");
    const count = await container.lotService.countMatching({
      status: "ended",
      categoryId: q.categoryId,
      categoryIds: q.categoryIds,
      endYear: q.endYear,
    });
    return c.json({ count });
  });

  r.post("/:id/publish", requireAuth, zValidator("param", lotIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const role = (c.get("userRole") ?? "client") as UserRole;
    const { id } = c.req.valid("param");
    const result = await container.lotService.publish(userId, role, id);
    if (result.isErr()) {
      return jsonLotOrAuthzError(c, result.error);
    }
    return c.json({ data: await presentLotImages(container.mediaUrlResolver, result.value) });
  });

  r.post("/:id/withdraw-request", requireAuth, zValidator("param", lotIdParamSchema), async (c) => {
    const sellerUserId = c.get("userId") as string;
    const { id } = c.req.valid("param");
    const result = await container.lotService.requestWithdrawal(sellerUserId, id);
    if (result.isErr()) {
      return jsonLotOrAuthzError(c, result.error);
    }
    return c.json({ data: result.value }, result.value.alreadyPending ? 200 : 201);
  });

  r.post(
    "/:id/cancel",
    requireAuth,
    zValidator("param", lotIdParamSchema),
    zValidator("json", cancelLotBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const role = (c.get("userRole") ?? "client") as UserRole;
      const { id } = c.req.valid("param");
      const result = await container.lotService.cancel(userId, role, id);
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({ data: await presentLotImages(container.mediaUrlResolver, result.value) });
    },
  );

  r.patch(
    "/:id",
    requireAuth,
    zValidator("param", lotIdParamSchema),
    zValidator("json", updateLotSchema),
    async (c) => {
      const role = (c.get("userRole") ?? "client") as UserRole;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json") as Partial<CreateLotInput>;
      const result = await container.lotService.update(role, id, body);
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({ data: await presentLotImages(container.mediaUrlResolver, result.value) });
    },
  );

  r.put(
    "/:id/marketing-details",
    requireAuth,
    zValidator("param", lotIdParamSchema),
    zValidator("json", updateLotMarketingDetailsSchema),
    async (c) => {
      const role = (c.get("userRole") ?? "client") as UserRole;
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const result = await container.lotService.updateMarketingDetails(role, id, body);
      if (result.isErr()) {
        return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
      }
      return c.json({ data: await presentLotImages(container.mediaUrlResolver, result.value) });
    },
  );

  r.get("/:id/bids", optionalAuth, zValidator("param", lotIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const lot = await container.lotService.getById(id);
    if (!lot) {
      return c.json({ error: "Not found" }, 404);
    }
    const raw = c.req.query("limit");
    const parsed = Number.parseInt(raw ?? "50", 10);
    const limit = Number.isFinite(parsed) ? Math.min(100, Math.max(1, parsed)) : 50;

    const role = (c.get("userRole") ?? "client") as UserRole;
    if (lot.auctionType === "sealed" && lot.status === "active") {
      if (!roleHasCapability(role, "auction.manage")) {
        return c.json({ data: [] });
      }
    }

    const bids = await container.bidService.listForLot(id, limit);
    const viewerId = c.get("userId");
    const canSeeBidderIds = roleHasCapability(role, "auction.manage");
    return c.json({
      data: bids.map((bid) => {
        const isOwnBid = viewerId && bid.placedByUserId === viewerId;
        const placedByUserId = bid.placedByUserId ?? "unknown";
        return {
          ...bid,
          bidderRef: bidderRef(id, placedByUserId),
          placedByUserId: canSeeBidderIds || isOwnBid ? bid.placedByUserId : null,
        };
      }),
    });
  });

  r.get("/:id", optionalAuth, zValidator("param", lotIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const role = c.get("userRole");
    const lot = await container.lotService.getById(id);
    if (!lot) {
      return c.json({ error: "Not found" }, 404);
    }
    const presented = await presentLotImages(container.mediaUrlResolver, lot);
    return c.json({ data: maskLotForPublicView(presented, role) });
  });

  r.post("/", requireAuth, zValidator("json", createLotSchema), async (c) => {
    const role = (c.get("userRole") ?? "client") as UserRole;
    if (!roleHasCapability(role, "auction.manage")) {
      return c.json({ error: "Only administrators can create lots" }, 403);
    }
    const userId = c.get("userId") as string;
    const body = c.req.valid("json") as CreateLotInput;
    if (!body.sellerLegalEntityId) {
      return c.json({ error: "sellerLegalEntityId is required" }, 400);
    }
    const result = await container.lotService.create(userId, body);
    if (result.isErr()) {
      return c.json({ error: result.error.message }, asHttpStatus(result.error.status));
    }
    return c.json({ data: await presentLotImages(container.mediaUrlResolver, result.value) }, 201);
  });

  return r;
}
