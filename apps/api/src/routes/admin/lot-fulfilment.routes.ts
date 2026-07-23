import {
  adminLotFulfilmentListQuerySchema,
  adminLotFulfilmentLotIdParamSchema,
  lotFulfilmentCollectBodySchema,
  lotFulfilmentReleaseBodySchema,
  lotFulfilmentShipBodySchema,
} from "@auction/validators";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import { requireOperationsFulfilment } from "../../middleware/require-capability.js";
import type { AdminCatalogSupportRoutesContainer } from "../../services/interfaces/admin-routes/admin-route-container-slices.js";
import type { AdminHono } from "./_shared.js";

export function attachAdminLotFulfilmentRoutes(
  platform: AdminHono,
  container: AdminCatalogSupportRoutesContainer,
): void {
  platform.get(
    "/lot-fulfilment",
    requireOperationsFulfilment,
    zValidator("query", adminLotFulfilmentListQuerySchema),
    async (c) => {
      const query = adminLotFulfilmentListQuerySchema.parse(c.req.valid("query"));
      const limit = query.limit ?? 50;
      const offset = query.offset ?? 0;
      const page = await container.admin.lotFulfilment.getPage({
        ...(query.q ? { q: query.q } : {}),
        ...(query.status !== undefined ? { status: query.status } : {}),
        limit,
        offset,
      });
      return c.json({
        data: page.rows,
        meta: {
          total: page.total,
          limit: page.limit,
          offset: page.offset,
          summary: page.summary,
        },
      });
    },
  );

  platform.get(
    "/lot-fulfilment/:lotId",
    requireOperationsFulfilment,
    zValidator("param", adminLotFulfilmentLotIdParamSchema),
    async (c) => {
      const { lotId } = c.req.valid("param");
      const data = await container.admin.lotFulfilment.getByLotIdForAdmin(lotId);
      return c.json({ data });
    },
  );

  platform.post(
    "/lot-fulfilment/:lotId/release",
    requireOperationsFulfilment,
    zValidator("param", adminLotFulfilmentLotIdParamSchema),
    zValidator("json", lotFulfilmentReleaseBodySchema),
    async (c) => {
      const { lotId } = c.req.valid("param");
      const body = c.req.valid("json");
      const userId = c.get("userId") as string;
      const result = await container.admin.lotFulfilment.approveRelease({
        lotId,
        actorUserId: userId,
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      });
      return result.match(
        (row) => c.json({ data: row }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/lot-fulfilment/:lotId/ship",
    requireOperationsFulfilment,
    zValidator("param", adminLotFulfilmentLotIdParamSchema),
    zValidator("json", lotFulfilmentShipBodySchema),
    async (c) => {
      const { lotId } = c.req.valid("param");
      const body = c.req.valid("json");
      const userId = c.get("userId") as string;
      const result = await container.admin.lotFulfilment.markShipped({
        lotId,
        actorUserId: userId,
        carrier: body.carrier,
        trackingNumber: body.trackingNumber,
      });
      return result.match(
        (row) => c.json({ data: row }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/lot-fulfilment/:lotId/ready-for-collection",
    requireOperationsFulfilment,
    zValidator("param", adminLotFulfilmentLotIdParamSchema),
    async (c) => {
      const { lotId } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const result = await container.admin.lotFulfilment.markReadyForCollection({
        lotId,
        actorUserId: userId,
      });
      return result.match(
        (row) => c.json({ data: row }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/lot-fulfilment/:lotId/delivered",
    requireOperationsFulfilment,
    zValidator("param", adminLotFulfilmentLotIdParamSchema),
    async (c) => {
      const { lotId } = c.req.valid("param");
      const userId = c.get("userId") as string;
      const result = await container.admin.lotFulfilment.markDelivered({
        lotId,
        actorUserId: userId,
      });
      return result.match(
        (row) => c.json({ data: row }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );

  platform.post(
    "/lot-fulfilment/:lotId/collected",
    requireOperationsFulfilment,
    zValidator("param", adminLotFulfilmentLotIdParamSchema),
    zValidator("json", lotFulfilmentCollectBodySchema),
    async (c) => {
      const { lotId } = c.req.valid("param");
      const body = c.req.valid("json");
      const userId = c.get("userId") as string;
      const result = await container.admin.lotFulfilment.markCollected({
        lotId,
        actorUserId: userId,
        collectedBy: body.collectedBy,
      });
      return result.match(
        (row) => c.json({ data: row }),
        (e) =>
          c.json({ error: e.message, ...(e.code ? { code: e.code } : {}) }, asHttpStatus(e.status)),
      );
    },
  );
}
