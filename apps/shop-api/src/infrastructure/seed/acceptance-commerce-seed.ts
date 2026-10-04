import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopArtworkInterest,
  shopBasketLine,
  shopEdition,
  shopOrder,
  shopOrderLine,
} from "@auction/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { ensureLaxShopParty } from "../ensure-lax-party.js";
import { authoriseAllOwnedEditionsForTests } from "../shop-test-authority.js";
import { SHOP_SEED_STRIPE_CHECKOUT_SLUG } from "./catalogue-seed.js";

/** POA original used by unavailable-notify-me staging acceptance. */
export const SHOP_ACCEPTANCE_ENQUIRY_ARTWORK_SLUG = "string-study";

/**
 * Clears enquiry interest for the acceptance identity so POA register-interest e2e can
 * click "Register interest" on every seeded run.
 */
export async function resetAcceptanceEnquiryInterestFixture(
  db: Database,
  identitySubjectId: string,
): Promise<void> {
  const subject = identitySubjectId.trim();
  if (!subject) {
    throw new Error("identitySubjectId is required for acceptance enquiry reset");
  }

  const artworkRows = await db
    .select({ id: shopArtwork.id })
    .from(shopArtwork)
    .where(eq(shopArtwork.slug, SHOP_ACCEPTANCE_ENQUIRY_ARTWORK_SLUG))
    .limit(1);
  const artworkId = artworkRows[0]?.id;
  if (!artworkId) {
    throw new Error(
      `Enquiry reset requires artwork ${SHOP_ACCEPTANCE_ENQUIRY_ARTWORK_SLUG}; run catalogue seed first`,
    );
  }

  await db
    .delete(shopArtworkInterest)
    .where(
      and(
        eq(shopArtworkInterest.artworkId, artworkId),
        eq(shopArtworkInterest.identitySubjectId, subject),
        eq(shopArtworkInterest.intent, "enquiry"),
      ),
    );
}

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

  await db.transaction(async (tx) => {
    const editionRows = await tx
      .select({ id: shopEdition.id })
      .from(shopEdition)
      .where(eq(shopEdition.artworkId, artworkId));
    const editionIds = editionRows.map((row) => row.id);

    if (editionIds.length > 0) {
      const staleLines = await tx
        .select({ orderId: shopOrderLine.orderId })
        .from(shopOrderLine)
        .innerJoin(shopOrder, eq(shopOrderLine.orderId, shopOrder.id))
        .where(
          and(
            inArray(shopOrderLine.editionId, editionIds),
            isNull(shopOrderLine.releasedAt),
            inArray(shopOrder.status, ["pending_payment", "payment_failed", "paid"]),
          ),
        );

      const staleOrderIds = [...new Set(staleLines.map((row) => row.orderId))];
      if (staleOrderIds.length > 0) {
        await tx
          .update(shopOrderLine)
          .set({ releasedAt: now })
          .where(
            and(
              inArray(shopOrderLine.orderId, staleOrderIds),
              inArray(shopOrderLine.editionId, editionIds),
              isNull(shopOrderLine.releasedAt),
            ),
          );
        await tx
          .update(shopOrder)
          .set({ status: "expired", updatedAt: now })
          .where(
            and(
              inArray(shopOrder.id, staleOrderIds),
              inArray(shopOrder.status, ["pending_payment", "payment_failed", "paid"]),
            ),
          );
      }
    }

    await tx.delete(shopBasketLine).where(eq(shopBasketLine.artworkId, artworkId));

    await tx
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
  });

  await authoriseAllOwnedEditionsForTests(db, artworkId);
}
