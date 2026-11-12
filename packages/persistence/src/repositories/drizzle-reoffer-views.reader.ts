import type { Database } from "@auction/db";
import {
  bid,
  bidIdentityDirectory,
  legalEntity,
  lot,
  lotReoffer,
  sellerConsent,
} from "@auction/db/schema";
import { bidderReofferStatus } from "@auction/domain";
import { and, asc, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  BidderReofferRow,
  IReofferViewsReader,
  SellerConsentRequestRow,
  StaffReofferView,
} from "../interfaces/reoffer-workflow.js";
import { toLotReofferView, toReofferRecord, toSellerConsentView } from "./lot-reoffer.mappers.js";

/**
 * What each party may see of an offer. The bidder's and the seller's reads are separate queries
 * with separate shapes, so nothing the other party owns can reach them: no seller, answer or
 * note for the bidder, no bidder or defaulting buyer for the seller.
 */
export class DrizzleReofferViewsReader implements IReofferViewsReader {
  constructor(private readonly db: Database) {}

  async listForLot(lotId: string): Promise<StaffReofferView[]> {
    const creator = alias(bidIdentityDirectory, "creator");
    const closer = alias(bidIdentityDirectory, "closer");
    const answerer = alias(bidIdentityDirectory, "answerer");
    const rows = await this.db
      .select({
        offer: lotReoffer,
        consent: sellerConsent,
        accountName: legalEntity.displayName,
        bidPlacedAt: bid.createdAt,
        createdByName: creator.name,
        closedByName: closer.name,
        answeredByName: answerer.name,
      })
      .from(lotReoffer)
      .leftJoin(sellerConsent, eq(sellerConsent.id, lotReoffer.sellerConsentId))
      .leftJoin(legalEntity, eq(legalEntity.id, lotReoffer.offeredLegalEntityId))
      .leftJoin(bid, eq(bid.id, lotReoffer.sourceBidId))
      .leftJoin(creator, eq(creator.subjectId, lotReoffer.createdBy))
      .leftJoin(closer, eq(closer.subjectId, lotReoffer.closedBy))
      .leftJoin(answerer, eq(answerer.subjectId, sellerConsent.answeredByUserId))
      .where(eq(lotReoffer.lotId, lotId))
      .orderBy(asc(lotReoffer.createdAt), asc(lotReoffer.sequence));
    return rows.map((row) => {
      const consent = row.consent ? toSellerConsentView(row.consent) : null;
      return {
        offer: toLotReofferView(row.offer),
        offeredAccountName: row.accountName ?? null,
        sourceBidPlacedAt: row.bidPlacedAt ?? null,
        createdByName: row.createdByName ?? null,
        closedByName: row.closedByName ?? null,
        consent: consent && {
          id: consent.id,
          status: consent.status,
          channel: consent.channel,
          note: consent.note,
          requestedAt: consent.requestedAt,
          dueAt: consent.dueAt,
          remindedAt: consent.remindedAt,
          answeredAt: consent.answeredAt,
          answeredByName: row.answeredByName ?? null,
          preferredNext: consent.preferredNext,
          terms: consent.termsSnapshot,
        },
      };
    });
  }

  async listForBidderAccount(legalEntityId: string): Promise<BidderReofferRow[]> {
    const rows = await this.db
      .select()
      .from(lotReoffer)
      .where(eq(lotReoffer.offeredLegalEntityId, legalEntityId))
      .orderBy(desc(lotReoffer.createdAt));
    return rows.flatMap((row) => toBidderRow(row) ?? []);
  }

  async findForBidderAccount(
    legalEntityId: string,
    reofferId: string,
  ): Promise<BidderReofferRow | null> {
    const [row] = await this.db
      .select()
      .from(lotReoffer)
      .where(and(eq(lotReoffer.id, reofferId), eq(lotReoffer.offeredLegalEntityId, legalEntityId)))
      .limit(1);
    return row ? toBidderRow(row) : null;
  }

  async listForSellerAccount(sellerLegalEntityId: string): Promise<SellerConsentRequestRow[]> {
    const rows = await this.db
      .select(SELLER_ROW)
      .from(sellerConsent)
      .innerJoin(lotReoffer, eq(lotReoffer.id, sellerConsent.subjectId))
      .innerJoin(lot, eq(lot.id, sellerConsent.lotId))
      .where(
        and(
          eq(sellerConsent.sellerLegalEntityId, sellerLegalEntityId),
          eq(sellerConsent.subjectType, "lot_reoffer"),
        ),
      )
      .orderBy(desc(sellerConsent.requestedAt));
    return rows.map(toSellerRow);
  }

  async findForSellerAccount(
    sellerLegalEntityId: string,
    reofferId: string,
  ): Promise<SellerConsentRequestRow | null> {
    const [row] = await this.db
      .select(SELLER_ROW)
      .from(sellerConsent)
      .innerJoin(lotReoffer, eq(lotReoffer.id, sellerConsent.subjectId))
      .innerJoin(lot, eq(lot.id, sellerConsent.lotId))
      .where(
        and(
          eq(sellerConsent.sellerLegalEntityId, sellerLegalEntityId),
          eq(sellerConsent.subjectType, "lot_reoffer"),
          eq(sellerConsent.subjectId, reofferId),
        ),
      )
      .limit(1);
    return row ? toSellerRow(row) : null;
  }
}

/** The columns a seller's read needs of a request: the consent, the offer and the lot's name. */
const SELLER_ROW = {
  consent: sellerConsent,
  offer: lotReoffer,
  lotTitle: lot.title,
  lotNumber: lot.lotNumber,
  lotEndTime: lot.endTime,
  lotExtendedUntil: lot.extendedUntil,
};

/** `null` while the bidder has nothing to see: the seller has not agreed, or said no. */
function toBidderRow(row: typeof lotReoffer.$inferSelect): BidderReofferRow | null {
  if (bidderReofferStatus(toReofferRecord(row)) === null) return null;
  const offer = toLotReofferView(row);
  return {
    id: offer.id,
    lotId: offer.lotId,
    status: offer.status,
    amountPence: offer.amountPence,
    offerSentAt: offer.offerSentAt,
    offerEndsAt: offer.offerEndsAt,
    respondedAt: offer.respondedAt,
    offeredUserId: offer.offeredUserId,
    offeredLegalEntityId: offer.offeredLegalEntityId,
  };
}

function toSellerRow(row: {
  consent: typeof sellerConsent.$inferSelect;
  offer: typeof lotReoffer.$inferSelect;
  lotTitle: string;
  lotNumber: number | null;
  lotEndTime: Date;
  lotExtendedUntil: Date | null;
}): SellerConsentRequestRow {
  const consent = toSellerConsentView(row.consent);
  const offer = toLotReofferView(row.offer);
  return {
    reofferId: consent.subjectId,
    lotId: consent.lotId,
    offerStatus: offer.status,
    consentStatus: consent.status,
    terms: consent.termsSnapshot,
    dueAt: consent.dueAt,
    lot: {
      title: row.lotTitle,
      lotNumber: row.lotNumber,
      endedAt: row.lotExtendedUntil ?? row.lotEndTime,
    },
    answeredAt: consent.answeredAt,
    answerChannel: consent.channel,
    preferredNext: consent.preferredNext,
    offerEndsAt: offer.offerEndsAt,
    respondedAt: offer.respondedAt,
  };
}
