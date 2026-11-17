import {
  adminDeliveriesListQuerySchema,
  adminDeliveryDeclineBodySchema,
  adminDeliveryLotIdParamSchema,
} from "@auction/validators";
import { zValidator } from "../../lib/z-validator.js";
import { requireDeliveries, requireDeliveriesRead } from "../../middleware/require-capability.js";
import type { AdminDeliveriesRoutesContainer } from "../../services/interfaces/admin-routes/index.js";
import type { AdminHono, AdminStaffMutationGuards } from "./_shared.js";

/**
 * The staff Deliveries screen (docs/design/staff-gaps-delivery-zoho-alerts.md, D7): its reads,
 * and declining a request (D8). Whoever can read Lot fulfilment may read it (D5: Fulfilment and
 * Administrators), and the same roles may decline. Pricing a quote stays on
 * `PUT /admin/lot-fulfilment/:lotId/delivery-quote`, which keeps its own guard. Every answer
 * carries the buyer's destination, so none is cached.
 */
export function attachAdminDeliveriesRoutes(
  platform: AdminHono,
  container: AdminDeliveriesRoutesContainer,
  guards: Pick<AdminStaffMutationGuards, "idempotent">,
): void {
  platform.use("/deliveries", requireDeliveriesRead);
  platform.use("/deliveries/*", requireDeliveriesRead);

  /** GET /admin/deliveries — one view, with counts per view for the same search and sale. */
  platform.get("/deliveries", zValidator("query", adminDeliveriesListQuerySchema), async (c) => {
    const data = await container.admin.deliveries.list(c.req.valid("query"));
    c.header("Cache-Control", "no-store");
    return c.json({ data });
  });

  /** GET /admin/deliveries/summary — the sidebar count: buyers waiting for a price. */
  platform.get("/deliveries/summary", async (c) => {
    const data = await container.admin.deliveries.summary();
    c.header("Cache-Control", "no-store");
    return c.json({ data });
  });

  /** GET /admin/deliveries/:lotId — one lot's delivery for the panel, with its history. */
  platform.get(
    "/deliveries/:lotId",
    zValidator("param", adminDeliveryLotIdParamSchema),
    async (c) => {
      const data = await container.admin.deliveries.detail(c.req.valid("param").lotId);
      if (!data) return c.json({ error: "delivery_not_found" }, 404);
      c.header("Cache-Control", "no-store");
      return c.json({ data });
    },
  );

  /**
   * POST /admin/deliveries/:lotId/decline — "Can't deliver" (D8): ends a requested or quoted
   * quote as withdrawn and tells the buyer the reason. One decline per Idempotency-Key, so a double
   * submit sends one email; a stale screen gets `quote_step_not_allowed` or `quote_changed`.
   */
  platform.post(
    "/deliveries/:lotId/decline",
    requireDeliveries,
    guards.idempotent("deliveries.decline"),
    zValidator("param", adminDeliveryLotIdParamSchema),
    zValidator("json", adminDeliveryDeclineBodySchema),
    async (c) => {
      const result = await container.admin.deliveryQuotes.decline({
        staffUserId: c.get("userId") as string,
        lotId: c.req.valid("param").lotId,
        reason: c.req.valid("json").reason,
      });
      c.header("Cache-Control", "no-store");
      return result.match(
        (data) => c.json({ data }),
        (e) => c.json({ error: e.code, message: e.message }, e.status),
      );
    },
  );
}
