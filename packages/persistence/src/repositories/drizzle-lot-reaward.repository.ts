import type { Database } from "@auction/db";
import { bid, buyerDefault, lot, lotFulfilment, lotReoffer, payment } from "@auction/db/schema";
import { reawardGuard } from "@auction/domain";
import { and, desc, eq, isNull, ne } from "drizzle-orm";
import {
  type ILotReawardRepository,
  LotReawardRefusedError,
  type ReawardLotInput,
  type ReawardLotResult,
} from "../interfaces/lot-reoffer.js";
import { decimalToPence, penceToDecimal, toReofferRecord } from "./lot-reoffer.mappers.js";

/**
 * What a fulfilment record holds before anything has happened for the new buyer. Every field that
 * belongs to the previous buyer or to their payment is cleared: their address, how they were to
 * receive the work, the release approval, the hand-over and when their payment cleared.
 */
const FRESH_FULFILMENT = {
  paymentId: null,
  status: "awaiting_payment",
  releaseApprovedByUserId: null,
  releaseApprovedAt: null,
  fulfilmentMethod: null,
  shippingCarrier: null,
  trackingNumber: null,
  collectedBy: null,
  collectedByUserId: null,
  collectedAt: null,
  addressSnapshot: null,
  paymentClearedAt: null,
  notes: null,
} as const satisfies Partial<typeof lotFulfilment.$inferInsert>;

/**
 * The lot's `reaward` transition: an accepted offer makes its bidder the lot's winner at the
 * offered amount. Everything is read and written in the caller's transaction, under a row lock
 * on the lot, so a payment or a second acceptance cannot slip in between the check and the write.
 *
 * Lock order is lot, then offer (the buyer default takes the lot lock first too). A caller that
 * moves an offer and re-awards in one transaction takes the lot lock before touching the offer.
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

    const record = toReofferRecord(offer);

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

    const [[latestDefault], [sourceBid], payments, otherOffers] = await Promise.all([
      tx
        .select({ id: buyerDefault.id, lotId: buyerDefault.lotId })
        .from(buyerDefault)
        .where(eq(buyerDefault.lotId, locked.id))
        .orderBy(desc(buyerDefault.createdAt), desc(buyerDefault.id))
        .limit(1),
      tx
        .select({
          lotId: bid.lotId,
          bidderId: bid.bidderId,
          legalEntityId: bid.buyerLegalEntityId,
          amount: bid.amount,
        })
        .from(bid)
        .where(eq(bid.id, offer.sourceBidId))
        .limit(1),
      tx.select({ status: payment.status }).from(payment).where(eq(payment.lotId, locked.id)),
      tx
        .select({ status: lotReoffer.status, offerSentAt: lotReoffer.offerSentAt })
        .from(lotReoffer)
        .where(
          and(eq(lotReoffer.buyerDefaultId, offer.buyerDefaultId), ne(lotReoffer.id, offer.id)),
        ),
    ]);

    // Only this offer's own earlier re-award counts as done, and only while the lot has not
    // defaulted again: matching on the lot's current winner would not do, since after a second
    // default that winner is gone and the offer must not win the lot back. A retry after a later
    // default falls through to the guard, which refuses it as superseded.
    if (offer.reawardedAt !== null && latestDefault?.id === offer.buyerDefaultId) {
      return result("already_reawarded", offer.reawardedAt);
    }

    const guard = reawardGuard({
      lot: { id: locked.id, status: locked.status, winnerId: locked.winnerId },
      offer: {
        lotId: offer.lotId,
        status: record.status,
        respondedAt: offer.respondedAt,
        buyerDefaultId: offer.buyerDefaultId,
        offeredUserId: offer.offeredUserId,
        offeredLegalEntityId: offer.offeredLegalEntityId,
        amountPence: offer.amountPence,
        sourceBid: sourceBid
          ? {
              lotId: sourceBid.lotId,
              bidderId: sourceBid.bidderId,
              legalEntityId: sourceBid.legalEntityId,
              amountPence: decimalToPence(sourceBid.amount),
            }
          : null,
      },
      latestDefault: latestDefault ?? null,
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

    // The sale is open again for the new buyer: a fresh awaiting-payment record, with nothing of
    // the previous buyer's left on it.
    await tx
      .insert(lotFulfilment)
      .values({ lotId: locked.id, ...FRESH_FULFILMENT })
      .onConflictDoUpdate({
        target: lotFulfilment.lotId,
        set: { ...FRESH_FULFILMENT, updatedAt: now },
      });

    // Done for this offer: a retry now changes nothing, and nothing but a later default ends it.
    await tx
      .update(lotReoffer)
      .set({ reawardedAt: now, updatedAt: now })
      .where(and(eq(lotReoffer.id, offer.id), isNull(lotReoffer.reawardedAt)));

    return result("reawarded", wonAt);
  }
}
