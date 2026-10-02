import type { Database } from "@auction/db";
import { shopArtwork, shopEdition } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { ensureLaxShopParty } from "../ensure-lax-party.js";
import { authoriseAllOwnedEditionsForTests } from "../shop-test-authority.js";
import { SHOP_SEED_STRIPE_CHECKOUT_SLUG } from "./catalogue-seed.js";

/**
 * Idempotent reset of the isolated Stripe checkout fixture so repeated acceptance runs
 * do not depend on harbor-print stock.
 */
export async function resetAcceptanceStripeCheckoutFixture(db: Database): Promise<void> {
  const artworkRows = await db
    .select({ id: shopArtwork.id })
    .from(shopArtwork)
    .where(eq(shopArtwork.slug, SHOP_SEED_STRIPE_CHECKOUT_SLUG))
    .limit(1);
  const artworkId = artworkRows[0]?.id;
  if (!artworkId) {
    throw new Error(
      `Stripe checkout reset requires artwork ${SHOP_SEED_STRIPE_CHECKOUT_SLUG}; run catalogue seed first`,
    );
  }

  const laxPartyId = await ensureLaxShopParty(db);
  const now = new Date();

  await db
    .update(shopEdition)
    .set({
      ownerPartyId: laxPartyId,
      listingStatus: "authorised",
      custodyStatus: "unprinted",
      saleAuthorisedAt: now,
      reservedUntil: null,
      reservedByOrderId: null,
    })
    .where(eq(shopEdition.artworkId, artworkId));

  await authoriseAllOwnedEditionsForTests(db, artworkId);
}
