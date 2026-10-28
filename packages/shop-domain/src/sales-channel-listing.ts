/**
 * Which works each storefront lists. LAX Shop sells edition runs; lax.art shows originals only, so
 * an editioned work (a limited or open edition) is never listed there even when it is not sold as
 * an edition run in Shop. Every public catalogue read applies this rule, so a storefront never
 * shows, counts or links to a work that belongs to the other one.
 */

export const SALES_CHANNELS = ["shop", "art"] as const;
export type SalesChannel = (typeof SALES_CHANNELS)[number];

export const ARTWORK_RARITIES = ["unique", "limited_edition", "open_edition"] as const;
export type ArtworkRarity = (typeof ARTWORK_RARITIES)[number];

export type SalesChannelListing = {
  /** Edition runs sold online, or originals sold by conversation. */
  readonly kind: "edition_run" | "original";
  /** Rarities the channel never lists. A work with no recorded rarity is not excluded by it. */
  readonly excludedRarities: readonly ArtworkRarity[];
};

export const SALES_CHANNEL_LISTINGS: Readonly<Record<SalesChannel, SalesChannelListing>> = {
  shop: { kind: "edition_run", excludedRarities: [] },
  art: { kind: "original", excludedRarities: ["limited_edition", "open_edition"] },
};

export type SalesChannelListingCandidate = {
  salesChannel: SalesChannel;
  eligibleForEditionAllocation: boolean;
  rarity: ArtworkRarity | null;
};

/** Whether the storefront lists this work. Visibility (published, not archived) is separate. */
export function isListedOnSalesChannel(
  artwork: SalesChannelListingCandidate,
  channel: SalesChannel,
): boolean {
  if (artwork.salesChannel !== channel) return false;
  const listing = SALES_CHANNEL_LISTINGS[channel];
  if (artwork.eligibleForEditionAllocation !== (listing.kind === "edition_run")) return false;
  return artwork.rarity === null || !listing.excludedRarities.includes(artwork.rarity);
}
