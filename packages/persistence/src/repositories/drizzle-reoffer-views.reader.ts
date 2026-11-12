import type { Database } from "@auction/db";
import { legalEntity, lotReoffer, sellerConsent } from "@auction/db/schema";
import { bidderReofferStatus } from "@auction/domain";
import { and, asc, desc, eq } from "drizzle-orm";
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
    const rows = await this.db
      .select({ offer: lotReoffer, consent: sellerConsent, accountName: legalEntity.displayName })
      .from(lotReoffer)
      .leftJoin(sellerConsent, eq(sellerConsent.id, lotReoffer.sellerConsentId))
      .leftJoin(legalEntity, eq(legalEntity.id, lotReoffer.offeredLegalEntityId))
      .where(eq(lotReoffer.lotId, lotId))
      .orderBy(asc(lotReoffer.createdAt), asc(lotReoffer.sequence));
    return rows.map((row) => {
      const consent = row.consent ? toSellerConsentView(row.consent) : null;
      return {
        offer: toLotReofferView(row.offer),
        offeredAccountName: row.accountName ?? null,
        consent: consent && {
          id: consent.id,
          status: consent.status,
          channel: consent.channel,
          note: consent.note,
          dueAt: consent.dueAt,
          answeredAt: consent.answeredAt,
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
      .select({ consent: sellerConsent, offer: lotReoffer })
      .from(sellerConsent)
      .innerJoin(lotReoffer, eq(lotReoffer.id, sellerConsent.subjectId))
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
      .select({ consent: sellerConsent, offer: lotReoffer })
      .from(sellerConsent)
      .innerJoin(lotReoffer, eq(lotReoffer.id, sellerConsent.subjectId))
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
}): SellerConsentRequestRow {
  const consent = toSellerConsentView(row.consent);
  return {
    reofferId: consent.subjectId,
    lotId: consent.lotId,
    offerStatus: toLotReofferView(row.offer).status,
    consentStatus: consent.status,
    terms: consent.termsSnapshot,
    dueAt: consent.dueAt,
  };
}
