import { registerForSaleBodySchema, saleIdParamSchema } from "@auction/validators";
import { respondBiddingRouteOutcome } from "../../lib/bidding-route-response.js";
import { zValidator } from "../../lib/z-validator.js";
import { requireBuyerRole } from "../../middleware/require-buyer-role.js";
import type { SaleAuxRouteDeps, SaleHono } from "./_shared.js";

export function attachSaleRegistrationRoutes(r: SaleHono, deps: SaleAuxRouteDeps): void {
  const { container, requireAuth, kycGate, requireLegalEntity } = deps;

  r.post(
    "/:id/register",
    requireAuth,
    requireBuyerRole,
    kycGate,
    requireLegalEntity,
    zValidator("param", saleIdParamSchema),
    zValidator("json", registerForSaleBodySchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const legalEntityContext = c.get("legalEntityContext");
      const { id: saleId } = c.req.valid("param");
      const body = c.req.valid("json");
      const outcome = await container.bidding.saleRegistrationHttp.requestRegistration({
        userId,
        saleId,
        ...(legalEntityContext?.legalEntityId !== undefined
          ? { actingLegalEntityId: legalEntityContext.legalEntityId }
          : {}),
        bodyLegalEntityId: body.buyerLegalEntityId,
        ...(body.bidLimit !== undefined ? { bidLimit: body.bidLimit } : {}),
      });
      return respondBiddingRouteOutcome(c, outcome, 201);
    },
  );

  r.get("/:id/my-registrations", requireAuth, zValidator("param", saleIdParamSchema), async (c) => {
    const userId = c.get("userId") as string;
    const { id: saleId } = c.req.valid("param");
    const outcome = await container.bidding.saleRegistrationHttp.listMineForSale({
      userId,
      saleId,
    });
    return respondBiddingRouteOutcome(c, outcome);
  });
}
