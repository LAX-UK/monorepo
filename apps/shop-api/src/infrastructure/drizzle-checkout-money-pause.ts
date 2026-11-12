import type { MoneyPauseReader } from "@auction/artwork-register-contracts";
import type { Database } from "@auction/db";
import { shopArtwork } from "@auction/db/schema";
import { and, inArray, isNotNull } from "drizzle-orm";
import type { CheckoutMoneyPause } from "../application/artwork-register/checkout-money-pause.js";

export function createDrizzleCheckoutMoneyPause(
  db: Database,
  pause: MoneyPauseReader,
): CheckoutMoneyPause {
  return {
    pause,
    async zohoProductIdsFor(artworkIds) {
      const rows = await db
        .select({ zohoProductId: shopArtwork.zohoProductId })
        .from(shopArtwork)
        .where(and(inArray(shopArtwork.id, [...artworkIds]), isNotNull(shopArtwork.zohoProductId)));
      return rows.flatMap((row) => (row.zohoProductId ? [row.zohoProductId] : []));
    },
  };
}
