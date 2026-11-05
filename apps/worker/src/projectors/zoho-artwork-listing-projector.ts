import type { Projector, ProjectorRunContext } from "./lib/projector.types.js";
import { processZohoProductDeliveries } from "./lib/zoho-product-deliveries.js";

export const ZOHO_ARTWORK_LISTING_PROJECTOR = "zoho_artwork_listing";

/**
 * Keeps the LAX listing on Zoho Products in line as register moves, lax.art listings, and Bid lots
 * and sales opening and closing happen. Its own cursor and ledger, so a listing retry never holds
 * up the Status writeback, and the other way round.
 */
export async function processZohoArtworkListing(ctx: ProjectorRunContext): Promise<void> {
  if (!ctx.zohoArtworkListing) return;
  await processZohoProductDeliveries(ctx, ZOHO_ARTWORK_LISTING_PROJECTOR, ctx.zohoArtworkListing);
}

export function createZohoArtworkListingProjector(): Projector {
  return {
    name: ZOHO_ARTWORK_LISTING_PROJECTOR,
    isEnabled(ctx) {
      return ctx.zohoArtworkListing != null;
    },
    async run(ctx) {
      await ctx.projectorStateRepo.ensureCursor(ZOHO_ARTWORK_LISTING_PROJECTOR);
      await processZohoArtworkListing(ctx);
    },
  };
}
