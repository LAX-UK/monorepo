import type { Database } from "@auction/db";
import {
  itemSubmission,
  legalEntity,
  lot,
  payment,
  payout,
  payoutLine,
  sale,
  unsoldLotChoice,
} from "@auction/db/schema";
import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type {
  AgreementDocumentFacts,
  IAgreementDocumentFactsReader,
  IPayoutLinesReader,
  IReturnedWorksReader,
  ISoldLotsReader,
  PayoutWithLines,
  ReturnedWorkRow,
  SoldLotRow,
} from "../interfaces/workspace-selling.readers.js";
import { submissionSenderSql } from "./submission-sender.sql.js";

export class DrizzleAgreementDocumentFactsReader implements IAgreementDocumentFactsReader {
  constructor(private readonly db: Database) {}

  async factsFor(submissionId: string): Promise<AgreementDocumentFacts | null> {
    const [row] = await this.db
      .select({
        submissionId: itemSubmission.id,
        legalEntityId: legalEntity.id,
        workTitle: itemSubmission.title,
        referenceNumber: itemSubmission.referenceNumber,
        legalName: legalEntity.legalName,
        displayName: legalEntity.displayName,
      })
      .from(itemSubmission)
      .innerJoin(legalEntity, eq(legalEntity.id, itemSubmission.legalEntityId))
      .where(eq(itemSubmission.id, submissionId))
      .limit(1);
    if (!row) return null;
    const { legalName, displayName, ...facts } = row;
    return { ...facts, sellerName: legalName?.trim() || displayName };
  }
}

/** Payments that stand for the sale: open or settled, not cancelled. */
const LIVE_PAYMENT = ["pending", "authorized", "captured", "requires_manual_review", "refunded"];

export class DrizzleSoldLotsReader implements ISoldLotsReader {
  constructor(private readonly db: Database) {}

  async list(input: {
    legalEntityId: string;
    from?: Date;
    to?: Date;
    limit: number;
    offset: number;
  }): Promise<SoldLotRow[]> {
    const lots = await this.db
      .select({
        lotId: lot.id,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
        saleTitle: sale.title,
        soldAt: lot.endTime,
        hammerPrice: lot.currentPrice,
      })
      .from(lot)
      .leftJoin(sale, eq(sale.id, lot.saleId))
      .where(
        and(
          eq(lot.sellerLegalEntityId, input.legalEntityId),
          eq(lot.status, "ended"),
          isNotNull(lot.winnerId),
          isNull(lot.deletedAt),
          input.from ? gte(lot.endTime, input.from) : undefined,
          input.to ? lt(lot.endTime, input.to) : undefined,
        ),
      )
      .orderBy(desc(lot.endTime), desc(lot.id))
      .limit(input.limit)
      .offset(input.offset);
    if (lots.length === 0) return [];

    const payments = await this.db
      .select({
        lotId: payment.lotId,
        status: payment.status,
        amount: payment.amount,
        platformFee: payment.platformFee,
        payoutId: payout.id,
        payoutStatus: payout.status,
        settledAt: payout.processedAt,
      })
      .from(payment)
      .leftJoin(payoutLine, and(eq(payoutLine.paymentId, payment.id), eq(payoutLine.kind, "sale")))
      .leftJoin(payout, eq(payout.id, payoutLine.payoutId))
      .where(
        and(
          inArray(
            payment.lotId,
            lots.map((l) => l.lotId),
          ),
          eq(payment.sellerLegalEntityId, input.legalEntityId),
          inArray(payment.status, LIVE_PAYMENT as (typeof payment.status.enumValues)[number][]),
        ),
      )
      .orderBy(desc(payment.createdAt));
    const byLot = new Map<string, (typeof payments)[number]>();
    for (const p of payments) if (!byLot.has(p.lotId)) byLot.set(p.lotId, p);

    return lots.map((l) => {
      const p = byLot.get(l.lotId);
      return {
        ...l,
        payment: p ? { status: p.status, amount: p.amount, platformFee: p.platformFee } : null,
        payout:
          p?.payoutId && p.payoutStatus
            ? {
                id: p.payoutId,
                status: p.payoutStatus as NonNullable<SoldLotRow["payout"]>["status"],
                settledAt: p.settledAt,
              }
            : null,
      };
    });
  }
}

export class DrizzlePayoutLinesReader implements IPayoutLinesReader {
  constructor(private readonly db: Database) {}

  async find(legalEntityId: string, payoutId: string): Promise<PayoutWithLines | null> {
    const [head] = await this.db
      .select()
      .from(payout)
      .where(and(eq(payout.id, payoutId), eq(payout.legalEntityId, legalEntityId)))
      .limit(1);
    if (!head) return null;
    const lines = await this.db
      .select({
        id: payoutLine.id,
        kind: payoutLine.kind,
        amount: payoutLine.amount,
        note: payoutLine.note,
        lotId: lot.id,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
        hammerPrice: lot.currentPrice,
        paymentAmount: payment.amount,
        platformFee: payment.platformFee,
      })
      .from(payoutLine)
      .leftJoin(payment, eq(payment.id, payoutLine.paymentId))
      .leftJoin(lot, eq(lot.id, payment.lotId))
      .where(eq(payoutLine.payoutId, payoutId))
      .orderBy(payoutLine.createdAt, payoutLine.id);
    return {
      id: head.id,
      status: head.status as PayoutWithLines["status"],
      currency: head.currency,
      grossAmount: head.grossAmount,
      platformFee: head.platformFee,
      stripeFee: head.stripeFee,
      netAmount: head.netAmount,
      periodStart: head.periodStart,
      periodEnd: head.periodEnd,
      processedAt: head.processedAt,
      lines: lines.map((l) => ({
        id: l.id,
        kind: l.kind,
        amount: l.amount,
        note: l.note,
        lot:
          l.lotId && l.lotTitle && l.hammerPrice
            ? { id: l.lotId, title: l.lotTitle, lotNumber: l.lotNumber, hammerPrice: l.hammerPrice }
            : null,
        payment:
          l.paymentAmount && l.platformFee
            ? { amount: l.paymentAmount, platformFee: l.platformFee }
            : null,
      })),
    };
  }
}

export class DrizzleReturnedWorksReader implements IReturnedWorksReader {
  constructor(private readonly db: Database) {}

  async list(input: {
    legalEntityId: string;
    visibleTo: Parameters<typeof submissionSenderSql>[0];
    limit: number;
    offset: number;
  }): Promise<ReturnedWorkRow[]> {
    // The choice for the lot's latest outcome; an earlier "collect" that was relisted is not a return.
    return this.db
      .select({
        submissionId: itemSubmission.id,
        lotId: lot.id,
        title: itemSubmission.title,
        medium: itemSubmission.medium,
        referenceNumber: itemSubmission.referenceNumber,
        returnedAt: unsoldLotChoice.decidedAt,
      })
      .from(itemSubmission)
      .innerJoin(lot, eq(lot.id, itemSubmission.convertedLotId))
      .innerJoin(
        unsoldLotChoice,
        and(eq(unsoldLotChoice.lotId, lot.id), eq(unsoldLotChoice.lotEndTime, lot.endTime)),
      )
      .where(
        and(
          eq(itemSubmission.legalEntityId, input.legalEntityId),
          isNull(lot.winnerId),
          eq(unsoldLotChoice.status, "confirmed"),
          eq(unsoldLotChoice.decidedChoice, "collect"),
          submissionSenderSql(input.visibleTo),
        ),
      )
      .orderBy(desc(sql`coalesce(${unsoldLotChoice.decidedAt}, ${lot.endTime})`), desc(lot.id))
      .limit(input.limit)
      .offset(input.offset);
  }
}
