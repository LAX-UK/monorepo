import type { Database } from "@auction/db";
import { shopArtwork } from "@auction/db/schema";
import {
  type PlannedPlacement,
  ShopDomainError,
  assertFeaturedOriginalArtwork,
} from "@auction/shop-domain";
import { inArray, sql } from "drizzle-orm";
import { listedOnSalesChannelSql } from "./sales-channel-listing-sql.js";

function artworkIdsIn(placements: readonly PlannedPlacement[], slot: PlannedPlacement["slot"]) {
  return placements
    .filter((placement) => placement.slot === slot && placement.target.kind === "artwork")
    .map((placement) => placement.target.id);
}

export async function assertHomePlacementsArtworkRules(
  db: Database,
  placements: readonly PlannedPlacement[],
): Promise<void> {
  const originalArtworkIds = artworkIdsIn(placements, "featured_originals");
  const printArtworkIds = artworkIdsIn(placements, "featured_prints");
  const artworkIds = [...originalArtworkIds, ...printArtworkIds];
  if (artworkIds.length === 0) {
    return;
  }
  const rows = await db
    .select({
      id: shopArtwork.id,
      eligibleForEditionAllocation: shopArtwork.eligibleForEditionAllocation,
      saleState: shopArtwork.saleState,
      isShopEdition: sql<boolean>`${listedOnSalesChannelSql("shop")}`,
    })
    .from(shopArtwork)
    .where(inArray(shopArtwork.id, artworkIds));
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const artworkId of originalArtworkIds) {
    const row = byId.get(artworkId);
    if (!row) {
      throw new Error(`featured_originals placement references unknown artwork ${artworkId}`);
    }
    assertFeaturedOriginalArtwork(row);
  }
  for (const artworkId of printArtworkIds) {
    const row = byId.get(artworkId);
    if (!row) {
      throw new Error(`featured_prints placement references unknown artwork ${artworkId}`);
    }
    if (!row.isShopEdition) {
      throw new ShopDomainError("featured_prints placements must reference Shop editions");
    }
  }
}
