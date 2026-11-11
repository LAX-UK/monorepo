import type { Database } from "@auction/db";
import { bid, buyerDefault, lot, lotFulfilment, lotReoffer, payment } from "@auction/db/schema";
import { reawardGuard } from "@auction/domain";
import { and, eq, ne } from "drizzle-orm";
import {
  type ILotReawardRepository,
  LotReawardRefusedError,
  type ReawardLotInput,
  type ReawardLotResult,
} from "../interfaces/lot-reoffer.js";
import { decimalToPence, penceToDecimal, toReofferRecord } from "./lot-reoffer.mappers.js";

/**
 * The lot's `reaward` transition: an accepted offer makes its bidder the lot's winner at the
 * offered amount. Everything is read and written in the caller's transaction, under a row lock
 * on the lot, so a payment or a second acceptance cannot slip in between the check and the write.
 */
export class DrizzleLotReawardRepository implements ILotReawardRepository {
  async reaward(tx: Database, input: ReawardLotInput): Promise<ReawardLotResult> {
    // The offer is read first only to learn which lot to lock; it is read again under the lock.
    const [located] = await tx
      .select({ lotId: lotReoffer.lotId })
      .from(lotReoffer)
      .where(eq(lotReoffer.id, input.reofferId))
      .limit(1);
    if (!located) throw new LotReawardRefusedError("offer_not_found", "The offer does not exist.");

    const [locked] = await tx
      .select({
        id: lot.id,
        status: lot.status,
        saleId: lot.saleId,
        sellerLegalEntityId: lot.sellerLegalEntityId,
        winnerId: lot.winnerId,
        buyerLegalEntityId: lot.buyerLegalEntityId,
        currentPrice: lot.currentPrice,
      })
      .from(lot)
      .where(eq(lot.id, located.lotId))
      .for("update")
      .limit(1);
    if (!locked) throw new LotReawardRefusedError("offer_not_found", "The lot does not exist.");

    const [offer] = await tx
      .select()
      .from(lotReoffer)
      .where(eq(lotReoffer.id, input.reofferId))
      .for("update")
      .limit(1);
    if (!offer) throw new LotReawardRefusedError("offer_not_found", "The offer does not exist.");

    const [original] = await tx
      .select({
        buyerId: buyerDefault.buyerId,
        hammerPrice: buyerDefault.hammerPrice,
      })
      .from(buyerDefault)
      .where(eq(buyerDefault.id, offer.buyerDefaultId))
      .limit(1);
    if (!original)
      throw new LotReawardRefusedError("offer_not_found", "The default does not exist.");

    const result = (outcome: ReawardLotResult["outcome"], wonAt: Date): ReawardLotResult => ({
      outcome,
      lotId: locked.id,
      saleId: locked.saleId,
      sellerLegalEntityId: locked.sellerLegalEntityId,
      reofferId: offer.id,
      buyerDefaultId: offer.buyerDefaultId,
      sequence: offer.sequence,
      newBuyerId: offer.offeredUserId,
      newBuyerLegalEntityId: offer.offeredLegalEntityId,
      previousBuyerId: original.buyerId,
      amountPence: offer.amountPence,
      originalHammerPence: decimalToPence(original.hammerPrice),
      wonAt,
    });

    // A repeated call after the lot was already re-awarded to this bidder changes nothing, even
    // once their own payment is under way.
    if (
      offer.status === "accepted" &&
      locked.status === "ended" &&
      locked.winnerId === offer.offeredUserId &&
      locked.buyerLegalEntityId === offer.offeredLegalEntityId
    ) {
      return result("already_reawarded", offer.respondedAt ?? new Date());
    }

    const [payments, otherOffers] = await Promise.all([
      tx.select({ status: payment.status }).from(payment).where(eq(payment.lotId, locked.id)),
      tx
        .select({ status: lotReoffer.status, offerSentAt: lotReoffer.offerSentAt })
        .from(lotReoffer)
        .where(
          and(eq(lotReoffer.buyerDefaultId, offer.buyerDefaultId), ne(lotReoffer.id, offer.id)),
        ),
    ]);

    const guard = reawardGuard({
      lot: { id: locked.id, status: locked.status, winnerId: locked.winnerId },
      offer: {
        lotId: offer.lotId,
        status: toReofferRecord(offer).status,
        respondedAt: offer.respondedAt,
      },
      payments,
      otherOffers: otherOffers.map(toReofferRecord),
    });
    if (!guard.ok) throw new LotReawardRefusedError(guard.code, guard.message);
    const wonAt = offer.respondedAt as Date;
    const now = new Date();

    await tx
      .update(lot)
      .set({
        winnerId: offer.offeredUserId,
        buyerLegalEntityId: offer.offeredLegalEntityId,
        currentPrice: penceToDecimal(offer.amountPence),
        endTime: wonAt,
        updatedAt: now,
      })
      .where(eq(lot.id, locked.id));

    // The winning bid is the bidder's own; no other bid on the lot is winning.
    await tx
      .update(bid)
      .set({ isWinning: false })
      .where(and(eq(bid.lotId, locked.id), ne(bid.id, offer.sourceBidId)));
    await tx.update(bid).set({ isWinning: true }).where(eq(bid.id, offer.sourceBidId));

    // The sale is open again for the new buyer: awaiting payment, with no payment attached yet.
    await tx
      .insert(lotFulfilment)
      .values({ lotId: locked.id, paymentId: null, status: "awaiting_payment" })
      .onConflictDoUpdate({
        target: lotFulfilment.lotId,
        set: { status: "awaiting_payment", paymentId: null, updatedAt: now },
      });

    return result("reawarded", wonAt);
  }
}
