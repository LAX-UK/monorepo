import type { Database } from "@auction/db";
import {
  bid,
  bidIdentityDirectory,
  bidUserProfile,
  buyerDefault,
  legalEntity,
  lot,
  lotReoffer,
  payment,
} from "@auction/db/schema";
import type { BidderAccountState, PriorOffer, ReofferRecord } from "@auction/domain";
import { and, asc, desc, eq, ne } from "drizzle-orm";
import type { LotReofferView } from "../interfaces/lot-reoffer.js";
import type {
  IReofferWorkflowReader,
  PlacedBidWithId,
  ReofferDefaultFacts,
  ReofferLockedLot,
} from "../interfaces/reoffer-workflow.js";
import { decimalToPence, toLotReofferView, toReofferRecord } from "./lot-reoffer.mappers.js";

/** Account standings that mean the bidder cannot be offered the lot. */
function accountState(row: {
  suspendedAt: Date | null;
  identityDisabledAt: Date | null;
  mergedIntoSubjectId: string | null;
  deletionRequestedAt: Date | null;
  entityStatus: string;
}): BidderAccountState {
  if (row.deletionRequestedAt !== null) return "deletion_pending";
  if (row.entityStatus === "archived" || row.mergedIntoSubjectId !== null) return "closed";
  if (
    row.suspendedAt !== null ||
    row.identityDisabledAt !== null ||
    row.entityStatus === "restricted" ||
    row.entityStatus === "rejected"
  ) {
    return "suspended";
  }
  return "active";
}

function toDefaultFacts(row: {
  id: string;
  lotId: string;
  buyerId: string;
  buyerLegalEntityId: string;
  sellerLegalEntityId: string;
  hammerPrice: string;
}): ReofferDefaultFacts {
  return {
    id: row.id,
    lotId: row.lotId,
    buyerId: row.buyerId,
    buyerLegalEntityId: row.buyerLegalEntityId,
    sellerLegalEntityId: row.sellerLegalEntityId,
    hammerPence: decimalToPence(row.hammerPrice),
  };
}

const DEFAULT_COLUMNS = {
  id: buyerDefault.id,
  lotId: buyerDefault.lotId,
  buyerId: buyerDefault.buyerId,
  buyerLegalEntityId: buyerDefault.buyerLegalEntityId,
  sellerLegalEntityId: buyerDefault.sellerLegalEntityId,
  hammerPrice: buyerDefault.hammerPrice,
};

/**
 * Reads for the re-offer steps. The lot lock is taken here so every caller takes it the same way,
 * lot first and offer second, as the re-award does.
 */
export class DrizzleReofferWorkflowReader implements IReofferWorkflowReader {
  async lockLot(tx: Database, lotId: string): Promise<ReofferLockedLot | null> {
    const [row] = await tx
      .select({
        id: lot.id,
        title: lot.title,
        lotNumber: lot.lotNumber,
        status: lot.status,
        saleId: lot.saleId,
        winnerId: lot.winnerId,
        sellerLegalEntityId: lot.sellerLegalEntityId,
        reservePrice: lot.reservePrice,
        deletedAt: lot.deletedAt,
      })
      .from(lot)
      .where(eq(lot.id, lotId))
      .for("update")
      .limit(1);
    if (!row) return null;
    const reservePence = row.reservePrice === null ? null : decimalToPence(row.reservePrice);
    return {
      id: row.id,
      title: row.title,
      lotNumber: row.lotNumber,
      status: row.status,
      saleId: row.saleId,
      winnerId: row.winnerId,
      sellerLegalEntityId: row.sellerLegalEntityId,
      reservePence: reservePence !== null && reservePence > 0 ? reservePence : null,
      deleted: row.deletedAt !== null,
    };
  }

  async lotIdOfOffer(db: Database, reofferId: string): Promise<string | null> {
    const [row] = await db
      .select({ lotId: lotReoffer.lotId })
      .from(lotReoffer)
      .where(eq(lotReoffer.id, reofferId))
      .limit(1);
    return row?.lotId ?? null;
  }

  async lockOffer(tx: Database, reofferId: string): Promise<LotReofferView | null> {
    const [row] = await tx
      .select()
      .from(lotReoffer)
      .where(eq(lotReoffer.id, reofferId))
      .for("update")
      .limit(1);
    return row ? toLotReofferView(row) : null;
  }

  async latestDefault(db: Database, lotId: string): Promise<ReofferDefaultFacts | null> {
    const [row] = await db
      .select(DEFAULT_COLUMNS)
      .from(buyerDefault)
      .where(eq(buyerDefault.lotId, lotId))
      .orderBy(desc(buyerDefault.createdAt), desc(buyerDefault.id))
      .limit(1);
    return row ? toDefaultFacts(row) : null;
  }

  async defaultById(db: Database, buyerDefaultId: string): Promise<ReofferDefaultFacts | null> {
    const [row] = await db
      .select(DEFAULT_COLUMNS)
      .from(buyerDefault)
      .where(eq(buyerDefault.id, buyerDefaultId))
      .limit(1);
    return row ? toDefaultFacts(row) : null;
  }

  async paymentStatuses(db: Database, lotId: string) {
    return db.select({ status: payment.status }).from(payment).where(eq(payment.lotId, lotId));
  }

  async placedBids(db: Database, lotId: string): Promise<PlacedBidWithId[]> {
    const rows = await db
      .select({
        bidId: bid.id,
        userId: bid.bidderId,
        legalEntityId: bid.buyerLegalEntityId,
        // The placed amount only: `max_auto_bid_amount` is never read, so a hidden maximum can
        // never become an offer price.
        amount: bid.amount,
        placedAt: bid.createdAt,
        suspendedAt: bidUserProfile.suspendedAt,
        identityDisabledAt: bidUserProfile.identityDisabledAt,
        mergedIntoSubjectId: bidUserProfile.mergedIntoSubjectId,
        deletionRequestedAt: bidIdentityDirectory.deletionRequestedAt,
        entityStatus: legalEntity.status,
      })
      .from(bid)
      .innerJoin(legalEntity, eq(legalEntity.id, bid.buyerLegalEntityId))
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, bid.bidderId))
      .leftJoin(bidIdentityDirectory, eq(bidIdentityDirectory.subjectId, bid.bidderId))
      .where(eq(bid.lotId, lotId))
      .orderBy(asc(bid.createdAt), asc(bid.id));
    return rows.map((row) => ({
      bidId: row.bidId,
      userId: row.userId,
      legalEntityId: row.legalEntityId,
      amountMinor: decimalToPence(row.amount),
      placedAt: row.placedAt,
      accountState: accountState({
        suspendedAt: row.suspendedAt ?? null,
        identityDisabledAt: row.identityDisabledAt ?? null,
        mergedIntoSubjectId: row.mergedIntoSubjectId ?? null,
        deletionRequestedAt: row.deletionRequestedAt ?? null,
        entityStatus: row.entityStatus,
      }),
    }));
  }

  async otherOffers(
    db: Database,
    buyerDefaultId: string,
    exceptReofferId: string,
  ): Promise<ReofferRecord[]> {
    const rows = await db
      .select({ status: lotReoffer.status, offerSentAt: lotReoffer.offerSentAt })
      .from(lotReoffer)
      .where(and(eq(lotReoffer.buyerDefaultId, buyerDefaultId), ne(lotReoffer.id, exceptReofferId)))
      .orderBy(asc(lotReoffer.sequence));
    return rows.map(toReofferRecord);
  }

  async priorOffers(db: Database, buyerDefaultId: string): Promise<PriorOffer[]> {
    const rows = await db
      .select({
        userId: lotReoffer.offeredUserId,
        legalEntityId: lotReoffer.offeredLegalEntityId,
        status: lotReoffer.status,
        offerSentAt: lotReoffer.offerSentAt,
      })
      .from(lotReoffer)
      .where(eq(lotReoffer.buyerDefaultId, buyerDefaultId))
      .orderBy(asc(lotReoffer.sequence));
    return rows.map((row) => ({
      userId: row.userId,
      legalEntityId: row.legalEntityId,
      ...toReofferRecord(row),
    }));
  }
}
