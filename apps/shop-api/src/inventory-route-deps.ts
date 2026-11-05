import type { ReopenArtListingService } from "./application/admin/reopen-art-listing.service.js";

/** What the machine-authenticated `/internal/inventory` routes need (LAX Bid calls them). */
export type InventoryRouteDeps = {
  reopen: Pick<ReopenArtListingService, "reopen">;
  /** The credential both products hold; unset means the boundary is closed (503), not open. */
  machine: { clientId: string | undefined; clientSecret: string | undefined };
};
