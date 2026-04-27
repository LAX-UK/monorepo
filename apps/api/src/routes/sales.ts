import {
  cancelSaleBodySchema,
  createNestedLotForSaleSchema,
  createSaleSchema,
  listSaleBiddersQuerySchema,
  listSaleLotsQuerySchema,
  listSalesQuerySchema,
  markSaleEndedBodySchema,
  saleIdParamSchema,
  saleLotIdParamSchema,
  updateLotStatusBodySchema,
  updateSaleSchema,
} from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Container } from "../container.js";
import { LotError } from "../lib/errors.js";
import { asHttpStatus } from "../lib/http-status.js";
import { createOptionalAuth } from "../middleware/optional-auth.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

export function createSaleRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const optionalAuth = createOptionalAuth(authenticator);
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();

  r.get("/", zValidator("query", listSalesQuerySchema), async (c) => {
    const query = c.req.valid("query");
    const data = await container.saleService.list({
      status: query.statuses ? undefined : query.status,
      statuses: query.statuses,
      categoryId: query.categoryId,
      limit: query.limit,
      offset: query.offset,
      sort: query.sort,
    });
    return c.json({ data });
  });

  r.get("/:id", optionalAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const bundle = await container.saleService.getByIdWithLots(id);
    if (!bundle) return c.json({ error: "Not found" }, 404);
    const userId = c.get("userId");
    const viewer = userId
      ? { isFollowing: await container.saleFollowService.isFollowing(userId, id) }
      : { isFollowing: false };
    return c.json({ data: { ...bundle, viewer } });
  });

  r.get(
    "/:id/lots",
    zValidator("param", saleIdParamSchema),
    zValidator("query", listSaleLotsQuerySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const q = c.req.valid("query");
      const page = await container.saleService.listLotsPage(id, {
        limit: q.limit,
        offset: q.offset,
        sort: q.sort,
      });
      if (!page) return c.json({ error: "Not found" }, 404);
      return c.json({
        data: {
          items: page.items,
          total: page.total,
          limit: q.limit,
          offset: q.offset,
          sort: q.sort,
        },
      });
    },
  );

  r.get(
    "/:id/bidders",
    zValidator("param", saleIdParamSchema),
    zValidator("query", listSaleBiddersQuerySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const q = c.req.valid("query");
      const page = await container.saleBiddersService.list(id, {
        limit: q.limit,
        offset: q.offset,
      });
      if (!page) return c.json({ error: "Not found" }, 404);
      return c.json({
        data: {
          items: page.items.map((b) => ({
            maskedName: b.maskedName,
            firstBidAt: b.firstBidAt,
          })),
          total: page.total,
          limit: q.limit,
          offset: q.offset,
        },
      });
    },
  );

  r.post("/:id/follow", requireAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const { id } = c.req.valid("param");
    const row = await container.saleFollowService.follow(userId, id);
    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json({ data: { isFollowing: true } });
  });

  r.delete("/:id/follow", requireAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const { id } = c.req.valid("param");
    await container.saleFollowService.unfollow(userId, id);
    return c.json({ data: { isFollowing: false } });
  });

  r.get("/:id/follow", requireAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const { id } = c.req.valid("param");
    const isFollowing = await container.saleFollowService.isFollowing(userId, id);
    return c.json({ data: { isFollowing } });
  });

  r.post("/", requireAuth, zValidator("json", createSaleSchema), async (c) => {
    const role = c.get("userRole") ?? "user";
    if (role !== "admin") {
      return c.json({ error: "Only admins can create sales" }, 403);
    }
    const userId = c.get("userId") as string;
    const body = c.req.valid("json");
    try {
      const sale = await container.saleService.create(userId, body);
      return c.json({ data: sale }, 201);
    } catch (e) {
      if (e instanceof LotError) {
        return c.json({ error: e.message }, asHttpStatus(e.status));
      }
      throw e;
    }
  });

  r.patch(
    "/:id",
    requireAuth,
    zValidator("param", saleIdParamSchema),
    zValidator("json", updateSaleSchema),
    async (c) => {
      const role = c.get("userRole") ?? "user";
      const { id } = c.req.valid("param");
      const patch = c.req.valid("json");
      const result = await container.saleService.updateDraft(role, id, patch);
      return result.match(
        (sale) => c.json({ data: sale }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

  r.post("/:id/publish", requireAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const role = c.get("userRole") ?? "user";
    const { id } = c.req.valid("param");
    const result = await container.saleService.publish(userId, role, id);
    return result.match(
      (data) => c.json({ data }),
      (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
    );
  });

  r.post(
    "/:id/cancel",
    requireAuth,
    zValidator("param", saleIdParamSchema),
    zValidator("json", cancelSaleBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const role = c.get("userRole") ?? "user";
      const { id } = c.req.valid("param");
      const result = await container.saleService.cancel(userId, role, id);
      return result.match(
        (sale) => c.json({ data: sale }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

  r.post(
    "/:id/lots",
    requireAuth,
    zValidator("param", saleIdParamSchema),
    zValidator("json", createNestedLotForSaleSchema),
    async (c) => {
      const role = c.get("userRole") ?? "user";
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const result = await container.saleService.addLot(role, id, body);
      return result.match(
        (lot) => c.json({ data: lot }, 201),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

  r.post(
    "/:id/lots/attach/:lotId",
    requireAuth,
    zValidator("param", saleLotIdParamSchema),
    async (c) => {
      const role = c.get("userRole") ?? "user";
      const { id, lotId } = c.req.valid("param");
      const result = await container.saleService.attachExistingLot(role, id, lotId);
      return result.match(
        (lot) => c.json({ data: lot }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

  r.delete(
    "/:id/lots/:lotId",
    requireAuth,
    zValidator("param", saleLotIdParamSchema),
    async (c) => {
      const role = c.get("userRole") ?? "user";
      const { id, lotId } = c.req.valid("param");
      const result = await container.saleService.detachLot(role, id, lotId);
      return result.match(
        () => c.body(null, 204),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

  r.post(
    "/:id/mark-ended",
    requireAuth,
    zValidator("param", saleIdParamSchema),
    zValidator("json", markSaleEndedBodySchema),
    async (c) => {
      const role = c.get("userRole") ?? "user";
      const { id } = c.req.valid("param");
      const { reason } = c.req.valid("json");
      const result = await container.saleStatusTransitionService.markOnsiteSaleEnded(
        role,
        id,
        reason,
      );
      return result.match(
        (data) => c.json({ data }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

  r.post(
    "/:id/lots/:lotId/cancel",
    requireAuth,
    zValidator("param", saleLotIdParamSchema),
    zValidator("json", cancelSaleBodySchema),
    async (c) => {
      const role = c.get("userRole") ?? "user";
      const { id, lotId } = c.req.valid("param");
      const { reason } = c.req.valid("json");
      const result = await container.saleStatusTransitionService.cancelLot(role, id, lotId, reason);
      return result.match(
        (lot) => c.json({ data: lot }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

  r.post(
    "/:id/lots/:lotId/status",
    requireAuth,
    zValidator("param", saleLotIdParamSchema),
    zValidator("json", updateLotStatusBodySchema),
    async (c) => {
      const role = c.get("userRole") ?? "user";
      const { id, lotId } = c.req.valid("param");
      const { status, reason } = c.req.valid("json");
      const result = await container.saleStatusTransitionService.setLotStatus(
        role,
        id,
        lotId,
        status,
        reason,
      );
      return result.match(
        (lot) => c.json({ data: lot }),
        (error) => c.json({ error: error.message }, asHttpStatus(error.status)),
      );
    },
  );

  return r;
}
