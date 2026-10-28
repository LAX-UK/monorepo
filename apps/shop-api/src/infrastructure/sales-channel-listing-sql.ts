import { shopArtwork } from "@auction/db/schema";
import { SALES_CHANNEL_LISTINGS, type SalesChannel } from "@auction/shop-domain";
import { type SQL, and, eq, isNull, notInArray, or } from "drizzle-orm";

/**
 * `isListedOnSalesChannel` from `@auction/shop-domain` as SQL: the works a storefront lists. Every
 * public read scoped to a channel (lists, facets, counts, categories, artists, cross-links) uses
 * this one condition, so the two storefronts cannot drift apart.
 */
export function listedOnSalesChannelSql(channel: SalesChannel): SQL {
  const listing = SALES_CHANNEL_LISTINGS[channel];
  const conditions: SQL[] = [
    eq(shopArtwork.salesChannel, channel),
    eq(shopArtwork.eligibleForEditionAllocation, listing.kind === "edition_run"),
  ];
  if (listing.excludedRarities.length > 0) {
    conditions.push(
      or(
        isNull(shopArtwork.rarity),
        notInArray(shopArtwork.rarity, [...listing.excludedRarities]),
      ) as SQL,
    );
  }
  return and(...conditions) as SQL;
}
