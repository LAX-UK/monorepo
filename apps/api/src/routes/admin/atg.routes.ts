import { lotIdParamSchema, saleIdParamSchema } from "@auction/validators";
import { z } from "zod";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import { requireAuctionManage } from "../../middleware/require-capability.js";
import type { IAtgAdminService } from "../../services/interfaces/atg-admin-service.js";
import type { AdminHono } from "./_shared.js";

const saleActionParamSchema = saleIdParamSchema.extend({
  action: z.enum(["push", "publish", "close"]),
});

const jobIdParamSchema = z.object({ jobId: z.string().min(1) });

/**
 * Staff-only ATG White Label controls under `/admin/integrations/atg`, gated on
 * `auction.manage`. Mutations only enqueue `atg-sync` jobs; the worker talks to ATG.
 */
export function attachAdminAtgRoutes(platform: AdminHono, atg: IAtgAdminService): void {
  // Guards must be path-scoped and registered before the routes they protect: Hono merges
  // handlers into one router, so a later `use("*")` would gate unrelated platform routes.
  platform.use("/integrations/atg", requireAuctionManage);
  platform.use("/integrations/atg/*", requireAuctionManage);

  platform.get("/integrations/atg/status", (c) => c.json({ data: atg.status() }));

  platform.get(
    "/integrations/atg/jobs/:jobId",
    zValidator("param", jobIdParamSchema),
    async (c) => {
      const { jobId } = c.req.valid("param");
      const state = await atg.getJobState(jobId);
      if (state == null) {
        return c.json({ error: "ATG sync is not enabled", code: "atg_disabled" }, 503);
      }
      return c.json({ data: { jobId, state } });
    },
  );

  platform.get("/integrations/atg/sales/:id", zValidator("param", saleIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const view = await atg.getSale(id);
    if (!view) return c.json({ error: "Sale not found", code: "sale_not_found" }, 404);
    return c.json({ data: view });
  });

  platform.post(
    "/integrations/atg/sales/:id/:action",
    zValidator("param", saleActionParamSchema),
    async (c) => {
      const { id, action } = c.req.valid("param");
      const result = await atg.enqueueSaleAction(id, action);
      if (!result.ok) {
        return c.json(
          { error: result.error.message, code: result.error.code },
          asHttpStatus(result.error.status),
        );
      }
      return c.json({ data: { jobId: result.jobId, action } }, 202);
    },
  );

  platform.delete(
    "/integrations/atg/lots/:id",
    zValidator("param", lotIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const result = await atg.enqueueLotDelete(id);
      if (!result.ok) {
        return c.json(
          { error: result.error.message, code: result.error.code },
          asHttpStatus(result.error.status),
        );
      }
      return c.json({ data: { jobId: result.jobId } }, 202);
    },
  );
}
