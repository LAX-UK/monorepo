import { lotNotDeleted } from "@auction/db";
import type { Database } from "@auction/db";
import {
  artistProfile,
  itemSubmission,
  legalEntity,
  legalEntityMember,
  lot,
  lotFulfilment,
  payment,
  paymentExternalRef,
  payout,
  payoutLine,
} from "@auction/db/schema";
import { and, desc, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import type {
  BidPaymentFact,
  BidPayoutFact,
  BidPortfolioFacts,
  BidSellerLotFact,
  BidSubmissionFact,
  BidWonLotFact,
  IBidPortfolioReader,
} from "../interfaces/bid-portfolio.reader.js";

/** Newest rows kept per list; a personal account that outgrows this needs paging, not a bigger read. */
const MAX_ROWS = 500;

const EMPTY: BidPortfolioFacts = {
  wonLots: [],
  payments: [],
  submissions: [],
  sellerLots: [],
  payouts: [],
};

export class DrizzleBidPortfolioReader implements IBidPortfolioReader {
  constructor(private readonly db: Database) {}

  async loadForPerson(userId: string): Promise<BidPortfolioFacts> {
    const entityId = await this.findPersonalEntityId(userId);
    if (!entityId) return { ...EMPTY };
    const wonLots = await this.listWonLots(entityId);
    const [payments, submissions, sellerLots, payouts] = await Promise.all([
      this.listPayments(
        entityId,
        userId,
        wonLots.map((lot) => lot.lotId),
      ),
      this.listSubmissions(entityId),
      this.listSellerLots(entityId),
      this.listPayouts(entityId),
    ]);
    return { wonLots, payments, submissions, sellerLots, payouts };
  }

  /** The person's own `individual` entity; organisations they belong to are never included. */
  private async findPersonalEntityId(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: legalEntity.id })
      .from(legalEntity)
      .innerJoin(
        legalEntityMember,
        and(
          eq(legalEntityMember.legalEntityId, legalEntity.id),
          eq(legalEntityMember.userId, userId),
          isNull(legalEntityMember.removedAt),
          isNotNull(legalEntityMember.acceptedAt),
        ),
      )
      .where(and(eq(legalEntity.kind, "individual"), eq(legalEntity.createdByUserId, userId)))
      .limit(1);
    return row?.id ?? null;
  }

  private async listWonLots(entityId: string): Promise<BidWonLotFact[]> {
    const rows = await this.db
      .select({
        lotId: lot.id,
        title: lot.title,
        artistName: artistProfile.displayName,
        images: lot.images,
        hammerPrice: lot.currentPrice,
        endedAt: lot.endTime,
        fulfilmentStatus: lotFulfilment.status,
      })
      .from(lot)
      .leftJoin(artistProfile, eq(artistProfile.id, lot.artistId))
      .leftJoin(lotFulfilment, eq(lotFulfilment.lotId, lot.id))
      .where(
        and(
          eq(lot.buyerLegalEntityId, entityId),
          eq(lot.status, "ended"),
          isNotNull(lot.winnerId),
          lotNotDeleted(),
        ),
      )
      .orderBy(desc(lot.endTime))
      .limit(MAX_ROWS);
    return rows.map((row) => ({
      lotId: row.lotId,
      title: row.title,
      artistName: row.artistName,
      firstImageKey: row.images[0] ?? null,
      hammerPrice: row.hammerPrice,
      endedAt: row.endedAt,
      fulfilmentStatus: row.fulfilmentStatus,
    }));
  }

  /**
   * Payments billed to the personal entity, plus the person's own payments for lots they won
   * personally even if the payment row was billed to another entity: the cost of a work the
   * person holds must not depend on which entity the invoice was addressed to.
   */
  private async listPayments(
    entityId: string,
    userId: string,
    wonLotIds: string[],
  ): Promise<BidPaymentFact[]> {
    const rows = await this.db
      .select({
        id: payment.id,
        lotId: payment.lotId,
        amount: payment.amount,
        status: payment.status,
        createdAt: payment.createdAt,
        invoiceNumber: paymentExternalRef.xeroInvoiceNumber,
        invoiceUrl: paymentExternalRef.onlineInvoiceUrl,
      })
      .from(payment)
      .leftJoin(paymentExternalRef, eq(paymentExternalRef.paymentId, payment.id))
      .where(
        or(
          eq(payment.buyerLegalEntityId, entityId),
          wonLotIds.length > 0
            ? and(eq(payment.buyerId, userId), inArray(payment.lotId, wonLotIds))
            : undefined,
        ),
      )
      .orderBy(desc(payment.createdAt))
      .limit(MAX_ROWS);
    return rows.map((row) => ({
      id: row.id,
      lotId: row.lotId,
      amount: row.amount,
      status: row.status,
      createdAt: row.createdAt,
      hasInvoice: row.invoiceNumber !== null || row.invoiceUrl !== null,
    }));
  }

  /** Consignments still waiting on LAX: once converted, the lot itself stands for the work. */
  private async listSubmissions(entityId: string): Promise<BidSubmissionFact[]> {
    const rows = await this.db
      .select({
        id: itemSubmission.id,
        title: itemSubmission.title,
        images: itemSubmission.images,
        createdAt: itemSubmission.createdAt,
      })
      .from(itemSubmission)
      .where(
        and(
          eq(itemSubmission.legalEntityId, entityId),
          inArray(itemSubmission.status, ["submitted", "under_review", "approved"]),
          isNull(itemSubmission.convertedLotId),
        ),
      )
      .orderBy(desc(itemSubmission.createdAt))
      .limit(MAX_ROWS);
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      firstImageKey: row.images[0] ?? null,
      createdAt: row.createdAt,
    }));
  }

  /** Lots the person consigned that are in a sale or have closed with a winner. */
  private async listSellerLots(entityId: string): Promise<BidSellerLotFact[]> {
    const rows = await this.db
      .select({
        lotId: lot.id,
        title: lot.title,
        artistName: artistProfile.displayName,
        images: lot.images,
        status: lot.status,
        createdAt: lot.createdAt,
        endedAt: lot.endTime,
        capturedPaymentId: payment.id,
        payoutStatus: payout.status,
        payoutStatementUrl: payout.statementUrl,
      })
      .from(lot)
      .leftJoin(artistProfile, eq(artistProfile.id, lot.artistId))
      .leftJoin(payment, and(eq(payment.lotId, lot.id), eq(payment.status, "captured")))
      .leftJoin(payoutLine, and(eq(payoutLine.paymentId, payment.id), eq(payoutLine.kind, "sale")))
      .leftJoin(payout, eq(payout.id, payoutLine.payoutId))
      .where(
        and(
          eq(lot.sellerLegalEntityId, entityId),
          lotNotDeleted(),
          or(
            inArray(lot.status, ["scheduled", "active"]),
            and(eq(lot.status, "ended"), isNotNull(lot.winnerId)),
          ),
        ),
      )
      .orderBy(desc(lot.createdAt))
      .limit(MAX_ROWS);
    return rows.map((row) => {
      const sold = row.status === "ended";
      return {
        lotId: row.lotId,
        title: row.title,
        artistName: row.artistName,
        firstImageKey: row.images[0] ?? null,
        stage: sold ? ("sold" as const) : ("in_sale" as const),
        occurredAt: sold ? row.endedAt : row.createdAt,
        buyerPaid: row.capturedPaymentId !== null,
        payoutStatus: row.payoutStatus,
        payoutHasStatement: row.payoutStatementUrl !== null,
      };
    });
  }

  private async listPayouts(entityId: string): Promise<BidPayoutFact[]> {
    const rows = await this.db
      .select({
        id: payout.id,
        currency: payout.currency,
        netAmount: payout.netAmount,
        platformFee: payout.platformFee,
        stripeFee: payout.stripeFee,
        status: payout.status,
        periodEnd: payout.periodEnd,
        processedAt: payout.processedAt,
        statementUrl: payout.statementUrl,
      })
      .from(payout)
      .where(eq(payout.legalEntityId, entityId))
      .orderBy(desc(payout.periodEnd))
      .limit(MAX_ROWS);
    return rows.map(({ statementUrl, ...row }) => ({
      ...row,
      hasStatement: statementUrl !== null,
    }));
  }
}
