import type { Database } from "@auction/db";
import { shopArtwork } from "@auction/db/schema";
import { type PlannedPlacement, assertFeaturedOriginalArtwork } from "@auction/shop-domain";
import { inArray } from "drizzle-orm";

export async function assertHomePlacementsArtworkRules(
  db: Database,
  placements: readonly PlannedPlacement[],
): Promise<void> {
  const originalArtworkIds = placements
    .filter(
      (placement) => placement.slot === "featured_originals" && placement.target.kind === "artwork",
    )
    .map((placement) => placement.target.id);
  if (originalArtworkIds.length === 0) {
    return;
  }
  const rows = await db
    .select({
      id: shopArtwork.id,
      eligibleForEditionAllocation: shopArtwork.eligibleForEditionAllocation,
      saleState: shopArtwork.saleState,
    })
    .from(shopArtwork)
    .where(inArray(shopArtwork.id, originalArtworkIds));
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const artworkId of originalArtworkIds) {
    const row = byId.get(artworkId);
    if (!row) {
      throw new Error(`featured_originals placement references unknown artwork ${artworkId}`);
    }
    assertFeaturedOriginalArtwork(row);
  }
}
