import { adminDeliveriesListQuerySchema, adminDeliveryLotIdParamSchema } from "@auction/validators";
import { zValidator } from "../../lib/z-validator.js";
import { requireDeliveriesRead } from "../../middleware/require-capability.js";
import type { AdminDeliveriesRoutesContainer } from "../../services/interfaces/admin-routes/index.js";
import type { AdminHono } from "./_shared.js";

/**
 * The staff Deliveries screen (docs/design/staff-gaps-delivery-zoho-alerts.md, D7): reads only.
 * Fulfilment, Administrators and read-only staff may read it; pricing a quote stays on
 * `PUT /admin/lot-fulfilment/:lotId/delivery-quote`, which keeps its own guard. Every answer
 * carries the buyer's destination, so none is cached.
 */
export function attachAdminDeliveriesRoutes(
  platform: AdminHono,
  container: AdminDeliveriesRoutesContainer,
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
}
