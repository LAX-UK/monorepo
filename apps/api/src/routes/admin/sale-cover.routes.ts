import {
  replaceHomePinsBodySchema,
  saleCoverSlotParamsSchema,
  saleHomeParamsSchema,
  setSaleCoverSlotBodySchema,
  updateSaleHomeBodySchema,
} from "@auction/validators";
import type { Context } from "hono";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import { requireSalesAccess, requireSalesRead } from "../../middleware/require-capability.js";
import type {
  SaleCoverError,
  SaleCoverService,
} from "../../services/sale-cover/sale-cover.service.js";
import type { AdminHono } from "./_shared.js";

type SaleCover = Pick<
  SaleCoverService,
  "getView" | "setSlot" | "clearSlot" | "updateHome" | "replaceHomePins"
>;

function failure(c: Context, error: SaleCoverError) {
  return c.json(
    {
      error: error.message,
      code: error.code,
      ...(error.issues ? { issues: error.issues } : {}),
    },
    asHttpStatus(error.status),
  );
}

/**
 * Staff choices for the home cover of a sale: the named cover slots, the featured lots, the
 * subtitle, the consignment deadline and the sales pinned to the home page. Reading needs access
 * to sales; changing anything needs the same right as editing a sale.
 */
export function attachAdminSaleCoverRoutes(platform: AdminHono, cover: SaleCover): void {
  platform.get(
    "/sales/:saleId/cover",
    requireSalesRead,
    zValidator("param", saleHomeParamsSchema),
    async (c) => {
      const result = await cover.getView(c.req.valid("param").saleId);
      return result.match(
        (view) => c.json({ data: view }),
        (error) => failure(c, error),
      );
    },
  );

  platform.put(
    "/sales/:saleId/cover/:slot",
    requireSalesAccess,
    zValidator("param", saleCoverSlotParamsSchema),
    zValidator("json", setSaleCoverSlotBodySchema),
    async (c) => {
      const { saleId, slot } = c.req.valid("param");
      const result = await cover.setSlot(saleId, slot, c.req.valid("json"));
      return result.match(
        (stored) => c.json({ data: stored }),
        (error) => failure(c, error),
      );
    },
  );

  platform.delete(
    "/sales/:saleId/cover/:slot",
    requireSalesAccess,
    zValidator("param", saleCoverSlotParamsSchema),
    async (c) => {
      const { saleId, slot } = c.req.valid("param");
      const result = await cover.clearSlot(saleId, slot);
      return result.match(
        () => c.body(null, 204),
        (error) => failure(c, error),
      );
    },
  );

  platform.patch(
    "/sales/:saleId/home",
    requireSalesAccess,
    zValidator("param", saleHomeParamsSchema),
    zValidator("json", updateSaleHomeBodySchema),
    async (c) => {
      const result = await cover.updateHome(c.req.valid("param").saleId, c.req.valid("json"));
      return result.match(
        (home) => c.json({ data: home }),
        (error) => failure(c, error),
      );
    },
  );

  platform.put(
    "/home-pins",
    requireSalesAccess,
    zValidator("json", replaceHomePinsBodySchema),
    async (c) => {
      const result = await cover.replaceHomePins(c.req.valid("json"));
      return result.match(
        (saleIds) => c.json({ data: { saleIds } }),
        (error) => failure(c, error),
      );
    },
  );
}
