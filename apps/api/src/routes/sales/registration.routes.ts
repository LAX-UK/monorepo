import { registerForSaleBodySchema, saleIdParamSchema } from "@auction/validators";
import { asHttpStatus } from "../../lib/http-status.js";
import { zValidator } from "../../lib/z-validator.js";
import { requireBuyerRole } from "../../middleware/require-buyer-role.js";
import type { SaleAuxRouteDeps, SaleHono } from "./_shared.js";

export function attachSaleRegistrationRoutes(r: SaleHono, deps: SaleAuxRouteDeps): void {
  const { container, requireAuth, kycGate } = deps;

  r.post(
    "/:id/register",
    requireAuth,
    requireBuyerRole,
    kycGate,
    zValidator("param", saleIdParamSchema),
    zValidator("json", registerForSaleBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const { id: saleId } = c.req.valid("param");
      const body = c.req.valid("json");
      const result = await container.saleRegistrationService.requestRegistration({
        userId,
        saleId,
        buyerLegalEntityId: body.buyerLegalEntityId,
        ...(body.bidLimit !== undefined ? { bidLimit: body.bidLimit } : {}),
      });
      if (result.isErr()) {
        const e = result.error;
        return c.json(
          e.code ? { error: e.message, code: e.code } : { error: e.message },
          asHttpStatus(e.status),
        );
      }
      return c.json({ data: result.value }, 201);
    },
  );

  r.get("/:id/my-registrations", requireAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const { id: saleId } = c.req.valid("param");
    const items = await container.saleRegistrationService.listMineForSale({ userId, saleId });
    return c.json({ data: { items } });
  });
}
