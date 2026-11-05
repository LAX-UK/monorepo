import type { ArtListingFacts } from "@auction/artwork-register-contracts";
import type { RegisterListingSource } from "@auction/persistence/interfaces";

/** Everything LAX knows about where one original is: the register, LAX Bid and lax.art. */
export type ListingFacts = RegisterListingSource & {
  /** The lax.art listing made from the record, when there is one. */
  laxArt: ArtListingFacts | null;
};
