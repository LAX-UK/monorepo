import type { ArtListingFacts } from "@auction/artwork-register-contracts";

/** The lax.art listings that carry these Zoho Product ids; ids without one are left out. */
export interface ArtListingLookup {
  findByZohoProductIds(zohoProductIds: readonly string[]): Promise<ArtListingFacts[]>;
}
