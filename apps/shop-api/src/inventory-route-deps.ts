import type { ReopenArtListingService } from "./application/admin/reopen-art-listing.service.js";
import type { ArtListingLookup } from "./application/ports/art-listing-lookup.js";

/** What the machine-authenticated `/internal/inventory` routes need (LAX Bid and the worker call them). */
export type InventoryRouteDeps = {
  reopen: Pick<ReopenArtListingService, "reopen">;
  /** lax.art listings by Zoho Product id, for the LAX listing the worker writes to Zoho. */
  lookup: ArtListingLookup;
  /** The credential both products hold; unset means the boundary is closed (503), not open. */
  machine: { clientId: string | undefined; clientSecret: string | undefined };
};
