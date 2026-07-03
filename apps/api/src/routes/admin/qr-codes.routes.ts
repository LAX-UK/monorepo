import {
  type ResolvedQrCodeAnalyticsQuery,
  adminQrCodeAnalyticsQuerySchema,
  adminQrCodeCreateSchema,
  adminQrCodeEntityQuerySchema,
  adminQrCodeIdParamSchema,
  adminQrCodeRegenerateSchema,
  adminQrCodeUpdateSchema,
  resolveQrCodeAnalyticsQuery,
} from "@auction/validators";
import type { ContainerAdminRoutesSlice } from "../../container.js";
import { zValidator } from "../../lib/z-validator.js";
import {
  requireCatalogueWrite,
  requireQrCodesAccess,
} from "../../middleware/require-capability.js";
import type { AdminHono } from "./_shared.js";

export function attachAdminQrCodesRoutes(
  platform: AdminHono,
  container: ContainerAdminRoutesSlice,
): void {
  platform.get(
    "/qr-codes",
    requireQrCodesAccess,
    zValidator("query", adminQrCodeEntityQuerySchema),
    async (c) => {
      const q = c.req.valid("query");
      const items = await container.admin.qrCodes.listForEntity(q.entityType, q.entityId);
      return c.json({ data: { items } });
    },
  );

  platform.post(
    "/qr-codes",
    requireCatalogueWrite,
    zValidator("json", adminQrCodeCreateSchema),
    async (c) => {
      const body = c.req.valid("json");
      const result = await container.admin.qrCodes.getOrCreateDefault({
        entityType: body.entityType,
        entityId: body.entityId,
        actorUserId: c.get("userId") ?? null,
      });
      if (!result) return c.json({ error: "Not found" }, 404);

      // This endpoint is an idempotent "ensure" used by detail pages and bulk
      // label printing. Only apply metadata when a code is freshly created so
      // repeated calls never clobber values set via PATCH. Edits go through the
      // dedicated PATCH /qr-codes/:id route.
      const hasMetadata =
        body.campaign !== undefined || body.placement !== undefined || body.expiresAt !== undefined;
      const item =
        result.created && hasMetadata
          ? ((await container.admin.qrCodes.update(result.item.id, {
              campaign: body.campaign ?? null,
              placement: body.placement ?? null,
              expiresAt: body.expiresAt ?? null,
            })) ?? result.item)
          : result.item;
      return c.json({ data: item }, result.created ? 201 : 200);
    },
  );

  platform.post(
    "/qr-codes/regenerate",
    requireCatalogueWrite,
    zValidator("json", adminQrCodeRegenerateSchema),
    async (c) => {
      const body = c.req.valid("json");
      const item = await container.admin.qrCodes.regenerateDefault({
        entityType: body.entityType,
        entityId: body.entityId,
        actorUserId: c.get("userId") ?? null,
      });
      if (!item) return c.json({ error: "Not found" }, 404);
      return c.json({ data: item }, 201);
    },
  );

  platform.patch(
    "/qr-codes/:id",
    requireCatalogueWrite,
    zValidator("param", adminQrCodeIdParamSchema),
    zValidator("json", adminQrCodeUpdateSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const item = await container.admin.qrCodes.update(id, c.req.valid("json"));
      if (!item) return c.json({ error: "Not found" }, 404);
      return c.json({ data: item });
    },
  );

  platform.get(
    "/qr-codes/:id/analytics",
    requireQrCodesAccess,
    zValidator("param", adminQrCodeIdParamSchema),
    zValidator("query", adminQrCodeAnalyticsQuerySchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const queryInput = c.req.valid("query");
      let resolved: ResolvedQrCodeAnalyticsQuery;
      try {
        resolved = resolveQrCodeAnalyticsQuery(queryInput);
      } catch {
        return c.json({ error: "Invalid analytics range" }, 400);
      }
      const data = await container.admin.qrCodes.getDetailedAnalytics(id, resolved);
      return c.json({ data });
    },
  );
}
