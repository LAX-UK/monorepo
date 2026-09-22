import { shopHomePlacement } from "@auction/db/schema";
import type { PlacementSlot } from "@auction/shop-domain";
import { and, eq, isNotNull } from "drizzle-orm";

/** Published home merchandising rows for a single placement slot. */
export function publishedHomePlacementForSlot(slot: PlacementSlot) {
  return and(eq(shopHomePlacement.slot, slot), isNotNull(shopHomePlacement.publishedAt));
}
