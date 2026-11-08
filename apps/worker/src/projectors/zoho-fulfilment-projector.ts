import type { Projector, ProjectorRunContext } from "./lib/projector.types.js";
import { processZohoProductDeliveries } from "./lib/zoho-product-deliveries.js";

export const ZOHO_FULFILMENT_PROJECTOR = "zoho_fulfilment";

/**
 * Mirrors print groups (and later orders) to Zoho CRM, one way. Its own cursor and delivery
 * ledger, so a retry here never holds up the artwork listing or the CRM sync, and the other way
 * round.
 */
export async function processZohoFulfilment(ctx: ProjectorRunContext): Promise<void> {
  if (!ctx.zohoFulfilment) return;
  await processZohoProductDeliveries(ctx, ZOHO_FULFILMENT_PROJECTOR, ctx.zohoFulfilment);
}

export function createZohoFulfilmentProjector(): Projector {
  return {
    name: ZOHO_FULFILMENT_PROJECTOR,
    isEnabled(ctx) {
      return ctx.zohoFulfilment != null;
    },
    async run(ctx) {
      await ctx.projectorStateRepo.ensureCursor(ZOHO_FULFILMENT_PROJECTOR);
      await processZohoFulfilment(ctx);
    },
  };
}
