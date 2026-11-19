import type { Projector, ProjectorRunContext } from "./lib/projector.types.js";
import { processZohoProductDeliveries } from "./lib/zoho-product-deliveries.js";

export const ZOHO_ARTWORK_LOCATION_PROJECTOR = "zoho_artwork_location";

/**
 * Keeps `LAX_Location` on Zoho Products in line as artworks move and locations are renamed or
 * retired. Its own cursor and ledger, so a location retry never holds up the listing or Status
 * writebacks, and the other way round.
 */
export async function processZohoArtworkLocation(ctx: ProjectorRunContext): Promise<void> {
  if (!ctx.zohoArtworkLocation) return;
  await processZohoProductDeliveries(ctx, ZOHO_ARTWORK_LOCATION_PROJECTOR, ctx.zohoArtworkLocation);
}

export function createZohoArtworkLocationProjector(): Projector {
  return {
    name: ZOHO_ARTWORK_LOCATION_PROJECTOR,
    isEnabled(ctx) {
      return ctx.zohoArtworkLocation != null;
    },
    async run(ctx) {
      await ctx.projectorStateRepo.ensureCursor(ZOHO_ARTWORK_LOCATION_PROJECTOR);
      await processZohoArtworkLocation(ctx);
    },
  };
}
