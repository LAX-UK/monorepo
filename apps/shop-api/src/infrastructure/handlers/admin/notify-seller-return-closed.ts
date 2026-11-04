import type { Database } from "@auction/db";
import { shopArtwork, shopEdition, shopParty, shopPayoutLedger } from "@auction/db/schema";
import {
  type ReturnStockOutcome,
  editionDisplayLabel,
  returnSellerPayout,
  returnStockOutcome,
} from "@auction/shop-domain";
import { eq } from "drizzle-orm";
import type { ShopTransactionEffects } from "../../../application/ports/shop-unit-of-work.js";

export type SellerReturnClosedInput = {
  returnId: string;
  editionId: string;
  orderLineId: string;
  sellerPartyId: string;
  listingStatus: "authorised" | "not_authorised" | "withdrawn";
};

/**
 * Tells the seller of a returned print that it has been received: what it means for their stock
 * and for their payout. The idempotency key is the return, so a repeat never sends a second
 * email. A seller without a sign-in (LAX's own stock) is not emailed. Nothing about the buyer
 * goes in the message.
 */
export async function notifySellerReturnClosed(
  db: Database,
  tx: ShopTransactionEffects,
  input: SellerReturnClosedInput,
): Promise<void> {
  const [seller] = await db
    .select({ identitySubjectId: shopParty.identitySubjectId })
    .from(shopParty)
    .where(eq(shopParty.id, input.sellerPartyId))
    .limit(1);
  if (!seller?.identitySubjectId) return;

  const [edition] = await db
    .select({
      title: shopArtwork.title,
      editionNumber: shopEdition.editionNumber,
      proofNumber: shopEdition.proofNumber,
    })
    .from(shopEdition)
    .innerJoin(shopArtwork, eq(shopArtwork.id, shopEdition.artworkId))
    .where(eq(shopEdition.id, input.editionId))
    .limit(1);
  if (!edition) return;

  const [ledger] = await db
    .select({ status: shopPayoutLedger.status })
    .from(shopPayoutLedger)
    .where(eq(shopPayoutLedger.orderLineId, input.orderLineId))
    .limit(1);
  const stockOutcome: ReturnStockOutcome = returnStockOutcome(input.listingStatus);

  await tx.notifications.queueReturnClosedSeller(tx.session, {
    idempotencyKey: `return-closed-seller:${input.returnId}`,
    sellerIdentitySubjectId: seller.identitySubjectId,
    artworkTitle: edition.title,
    editionLabel: editionDisplayLabel(edition),
    stockOutcome,
    payout: returnSellerPayout(ledger?.status ?? null),
  });
}
