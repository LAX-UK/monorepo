import type { Database } from "@auction/db";
import { shopHomePlacement } from "@auction/db/schema";
import { type PlannedPlacement, assertValidPlacementSet } from "@auction/shop-domain";
import { inArray } from "drizzle-orm";
import type {
  ReplaceHomePlacementsCommand,
  StorefrontCurationWriter,
} from "../application/ports/storefront-curation.writer.js";

function rowForPlacement(placement: PlannedPlacement, publishedAt: Date) {
  const base = {
    slot: placement.slot,
    position: placement.position,
    publishedAt,
  };
  switch (placement.target.kind) {
    case "artwork":
      return { ...base, artworkId: placement.target.id, artistId: null, categoryId: null };
    case "artist":
      return { ...base, artworkId: null, artistId: placement.target.id, categoryId: null };
    case "category":
      return { ...base, artworkId: null, artistId: null, categoryId: placement.target.id };
  }
}

export function createDrizzleStorefrontCurationWriter(db: Database): StorefrontCurationWriter {
  return {
    async replaceHomePlacements(command: ReplaceHomePlacementsCommand): Promise<void> {
      assertValidPlacementSet(command.placements);
      const slots = [...new Set(command.slots)];
      if (command.placements.some((placement) => !slots.includes(placement.slot))) {
        throw new Error("Every placement must belong to a replaced slot");
      }
      await db.transaction(async (tx) => {
        if (slots.length > 0) {
          await tx.delete(shopHomePlacement).where(inArray(shopHomePlacement.slot, slots));
        }
        if (command.placements.length === 0) return;
        await tx
          .insert(shopHomePlacement)
          .values(
            command.placements.map((placement) => rowForPlacement(placement, command.publishedAt)),
          );
      });
    },
  };
}
