import { ATG_AUCTION_TYPES, ATG_DISTRIBUTIONS } from "@auction/types";
import { lotIdParamSchema, saleIdParamSchema } from "@auction/validators";
import { Hono } from "hono";
import { z } from "zod";
import { asHttpStatus } from "../lib/http-status.js";
import { zValidator } from "../lib/z-validator.js";
import type { IAtgAdminService } from "../services/interfaces/atg-admin-service.js";

const saleActionParamSchema = saleIdParamSchema.extend({
  action: z.enum(["push", "publish", "close"]),
});

const jobIdParamSchema = z.object({ jobId: z.string().min(1) });

const saleSettingsBodySchema = z
  .object({
    auctionType: z.enum(ATG_AUCTION_TYPES),
    distribution: z.enum(ATG_DISTRIBUTIONS),
    confirmPublic: z.boolean().default(false),
  })
  .strict();

/**
 * Staff-only ATG White Label controls, mounted at `/admin/integrations/atg`. ATG traffic only
 * happens through enqueued `atg-sync` jobs; the worker talks to ATG.
 */
export function createAdminAtgRoutes(atg: IAtgAdminService) {
  const r = new Hono<{ Variables: { userId?: string } }>();

  r.get("/status", (c) => c.json({ data: atg.status() }));

  r.get("/jobs/:jobId", zValidator("param", jobIdParamSchema), async (c) => {
    const { jobId } = c.req.valid("param");
    const state = await atg.getJobState(jobId);
    if (state == null) {
      return c.json({ error: "ATG sync is not enabled", code: "atg_disabled" }, 503);
    }
    return c.json({ data: { jobId, state } });
  });

  r.get("/sales/:id", zValidator("param", saleIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const view = await atg.getSale(id);
    if (!view) return c.json({ error: "Sale not found", code: "sale_not_found" }, 404);
    return c.json({ data: view });
  });

  r.put(
    "/sales/:id/settings",
    zValidator("param", saleIdParamSchema),
    zValidator("json", saleSettingsBodySchema),
    async (c) => {
      const userId = c.get("userId");
      if (!userId) return c.json({ error: "Unauthorized", code: "unauthorized" }, 401);
      const result = await atg.updateSaleSettings(
        c.req.valid("param").id,
        c.req.valid("json"),
        userId,
      );
      if (!result.ok) {
        return c.json(
          { error: result.error.message, code: result.error.code },
          asHttpStatus(result.error.status),
        );
      }
      return c.json({ data: { settings: result.settings, pushJobId: result.pushJobId } });
    },
  );

  r.post("/sales/:id/:action", zValidator("param", saleActionParamSchema), async (c) => {
    const { id, action } = c.req.valid("param");
    const result = await atg.enqueueSaleAction(id, action);
    if (!result.ok) {
      return c.json(
        { error: result.error.message, code: result.error.code },
        asHttpStatus(result.error.status),
      );
    }
    return c.json({ data: { jobId: result.jobId, action } }, 202);
  });

  r.delete("/lots/:id", zValidator("param", lotIdParamSchema), async (c) => {
    const { id } = c.req.valid("param");
    const result = await atg.enqueueLotDelete(id);
    if (!result.ok) {
      return c.json(
        { error: result.error.message, code: result.error.code },
        asHttpStatus(result.error.status),
      );
    }
    return c.json({ data: { jobId: result.jobId } }, 202);
  });

  return r;
}
