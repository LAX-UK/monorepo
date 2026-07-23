import { z } from "zod";
import type { ContainerAdminPlatformRoutesSlice } from "../../container.js";
import { createBaseLogger } from "../../lib/logger.js";
import { zValidator } from "../../lib/z-validator.js";
import { createAuditAccessMiddleware } from "../../middleware/audit-access.js";
import { requireAuditDomainEvents } from "../../middleware/require-capability.js";
import type { AdminHono } from "./_shared.js";

const deliveryListQuerySchema = z.object({
  consumer: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const deliveryIdParamSchema = z.object({
  deliveryId: z.coerce.number().int().positive(),
});

const webhookReplayBodySchema = z.object({
  eventKey: z.string().min(1),
});

export function attachAdminDeliveryOpsRoutes(
  platform: AdminHono,
  container: ContainerAdminPlatformRoutesSlice,
): void {
  const auditAccess = createAuditAccessMiddleware(createBaseLogger(container.env));
  platform.use("/system/delivery/*", requireAuditDomainEvents);
  platform.use("/system/delivery/*", auditAccess);

  platform.get(
    "/system/delivery/dead-letter",
    requireAuditDomainEvents,
    zValidator("query", deliveryListQuerySchema),
    async (c) => {
      const query = c.req.valid("query");
      const data = await container.admin.deliveryOps.listDeadLetters({
        ...(query.consumer !== undefined ? { consumer: query.consumer } : {}),
        limit: query.limit,
        offset: query.offset,
      });
      return c.json({ data });
    },
  );

  platform.get(
    "/system/delivery/:deliveryId",
    requireAuditDomainEvents,
    zValidator("param", deliveryIdParamSchema),
    async (c) => {
      const { deliveryId } = c.req.valid("param");
      const row = await container.admin.deliveryOps.getDomainDelivery(deliveryId);
      if (!row) return c.json({ error: "delivery_not_found" }, 404);
      return c.json({ data: row });
    },
  );

  platform.post(
    "/system/delivery/:deliveryId/replay",
    requireAuditDomainEvents,
    zValidator("param", deliveryIdParamSchema),
    async (c) => {
      const { deliveryId } = c.req.valid("param");
      await container.admin.deliveryOps.replayDomainDelivery(deliveryId);
      return c.json({ ok: true });
    },
  );

  platform.post(
    "/system/delivery/webhook/retry",
    requireAuditDomainEvents,
    zValidator("json", webhookReplayBodySchema),
    async (c) => {
      const { eventKey } = c.req.valid("json");
      await container.admin.deliveryOps.markWebhookRetry(eventKey);
      return c.json({ ok: true });
    },
  );
}
