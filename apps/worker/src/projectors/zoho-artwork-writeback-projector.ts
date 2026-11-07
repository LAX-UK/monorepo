import type { Projector, ProjectorRunContext } from "./lib/projector.types.js";
import { processZohoProductDeliveries } from "./lib/zoho-product-deliveries.js";

export const ZOHO_ARTWORK_WRITEBACK_PROJECTOR = "zoho_artwork_writeback";

/** Sends artwork register changes (the Status and the stock code) to Zoho Products. */
export async function processZohoArtworkWriteback(ctx: ProjectorRunContext): Promise<void> {
  if (!ctx.zohoArtworkWriteback) return;
  await processZohoProductDeliveries(
    ctx,
    ZOHO_ARTWORK_WRITEBACK_PROJECTOR,
    ctx.zohoArtworkWriteback,
  );
}

export function createZohoArtworkWritebackProjector(): Projector {
  return {
    name: ZOHO_ARTWORK_WRITEBACK_PROJECTOR,
    isEnabled(ctx) {
      return ctx.zohoArtworkWriteback != null;
    },
    async run(ctx) {
      await ctx.projectorStateRepo.ensureCursor(ZOHO_ARTWORK_WRITEBACK_PROJECTOR);
      await processZohoArtworkWriteback(ctx);
    },
  };
}
