import type { AdminEditionLookupItem } from "@auction/shop-contracts";
import { EDITION_LISTING_LABELS } from "./edition-listing.copy";
import { type LookupOption, editionLabel } from "./lookup-options.vm";

/*
 * The edition picker's option. Server only: the listing labels stay out of the client bundles
 * that import `lookup-options.vm` for the shared types and name helpers.
 */

/** A listing status as staff read it; a status the app does not know yet reads in sentence case. */
export function editionListingLabel(status: string): string {
  const known = (EDITION_LISTING_LABELS as Record<string, string>)[status];
  if (known) return known;
  const words = status.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function editionOption(item: AdminEditionLookupItem): LookupOption {
  return {
    id: item.editionId,
    label: editionLabel(item),
    description: item.artistName,
    meta: editionListingLabel(item.listingStatus),
  };
}
