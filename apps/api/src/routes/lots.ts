import { roleHasCapability, type CreateLotInput, type UserRole } from "@auction/types";
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
import { Hono } from "hono";
import type { Container } from "../container.js";
import { asHttpStatus } from "../lib/http-status.js";
import { maskLotForPublicView } from "../lib/lot-public-view.js";
import { createOptionalAuth } from "../middleware/optional-auth.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export function createLotRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const optionalAuth = createOptionalAuth(authenticator);
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();

  r.get("/", optionalAuth, zValidator("query", listLotsQuerySchema), async (c) => {
    const query = c.req.valid("query");
    const role = c.get("userRole");
    const data = await container.lotService.list({
      status: query.status,
      categoryId: query.categoryId,
      sellerId: query.sellerId,
      winnerId: query.winnerId,
      saleId: query.saleId,
      endYear: query.endYear,
      search: query.q,
      sort: query.sort,
      limit: query.limit,
      offset: query.offset,
    });
    return c.json({ data: data.map((lotRow) => maskLotForPublicView(lotRow, role)) });
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
      endYear: q.endYear,
    });
    return c.json({ count });
  });

  r.post("/:id/publish", requireAuth, zValidator("param", lotIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const role = (c.get("userRole") ?? "client") as UserRole;
    const { id } = c.req.valid("param");
    const result = await container.lotService.publish(userId, role, id);
    return result.match(
      (lot) => c.json({ data: lot }),
      (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
    );
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
      return result.match(
        (lot) => c.json({ data: lot }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
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
      return result.match(
        (lot) => c.json({ data: lot }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
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
      return result.match(
        (lot) => c.json({ data: lot }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
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
    return c.json({ data: bids });
  });

  r.get("/:id", optionalAuth, zValidator("param", lotIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const role = c.get("userRole");
    const lot = await container.lotService.getById(id);
    if (!lot) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json({ data: maskLotForPublicView(lot, role) });
  });

  r.post("/", requireAuth, zValidator("json", createLotSchema), async (c) => {
    const role = (c.get("userRole") ?? "client") as UserRole;
    if (!roleHasCapability(role, "auction.manage")) {
      return c.json({ error: "Only administrators can create lots" }, 403);
    }
    const userId = c.get("userId") as string;
    const body = c.req.valid("json");
    const result = await container.lotService.create(userId, body);
    return result.match(
      (lot) => c.json({ data: lot }, 201),
      (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
    );
  });

  return r;
}
