import type { Database } from "@auction/db";
import {
  bidInvoiceLine,
  consignmentAgreement,
  itemSubmission,
  legalEntity,
  lot,
  payment,
  payout,
  payoutLine,
  saleSellerTerms,
} from "@auction/db/schema";
import { type SellerTermsHeldReason, consignmentReference } from "@auction/domain";
import { and, asc, count, desc, eq, inArray, isNull, notExists, sql } from "drizzle-orm";
import type {
  IStaffPayoutSalesReader,
  StaffHeldSale,
  StaffLineAgreement,
  StaffOldRuleSale,
  StaffPayoutSaleLine,
  StaffPayoutSales,
} from "../interfaces/staff-payout-sales.reader.js";
import { pricedOnEarlierVersion } from "./agreement-version.js";

const money = (value: unknown) => String(value);

/**
 * Payouts' sale lines for staff: each line with the snapshot it pays (or the old-rule payment it
 * kept), its lot and the agreement behind it, the seller's sales still held, and the lines paid
 * before the signed-agreement rule. Every figure is read as stored.
 */
export class DrizzleStaffPayoutSalesReader implements IStaffPayoutSalesReader {
  constructor(private readonly db: Database) {}

  async forPayout(payoutId: string): Promise<StaffPayoutSales | null> {
    const [row] = await this.db.select().from(payout).where(eq(payout.id, payoutId)).limit(1);
    if (!row) return null;

    const lines = await this.db
      .select({
        lineId: payoutLine.id,
        paymentId: payoutLine.paymentId,
        amount: payoutLine.amount,
        lotId: payment.lotId,
        lotNumber: lot.lotNumber,
        lotTitle: lot.title,
        paymentAmount: payment.amount,
        platformFee: payment.platformFee,
        terms: {
          id: saleSellerTerms.id,
          hammerPence: saleSellerTerms.hammerPence,
          commissionBps: saleSellerTerms.commissionBps,
          commissionPence: saleSellerTerms.commissionPence,
          commissionVatTreatment: saleSellerTerms.commissionVatTreatment,
          commissionVatBps: saleSellerTerms.commissionVatBps,
          commissionVatPence: saleSellerTerms.commissionVatPence,
          sellerNetPence: saleSellerTerms.sellerNetPence,
          agreementId: saleSellerTerms.agreementId,
          computedAt: saleSellerTerms.computedAt,
        },
      })
      .from(payoutLine)
      .innerJoin(payment, eq(payment.id, payoutLine.paymentId))
      .innerJoin(lot, eq(lot.id, payment.lotId))
      .leftJoin(saleSellerTerms, eq(saleSellerTerms.id, payoutLine.sellerTermsId))
      .where(and(eq(payoutLine.payoutId, payoutId), eq(payoutLine.kind, "sale")))
      .orderBy(asc(lot.lotNumber), asc(payoutLine.createdAt));

    const lotIds = lines.map((line) => line.lotId);
    const pricedOn = lines.flatMap((line) =>
      line.terms?.agreementId ? [line.terms.agreementId] : [],
    );
    const [agreements, snapshotAgreements, heldForSeller] = await Promise.all([
      this.agreementsFor(lotIds),
      this.agreementsById(pricedOn),
      this.heldFor(row.legalEntityId),
    ]);

    const sales: StaffPayoutSaleLine[] = lines.map((line) => {
      const t = line.terms;
      const priced =
        t?.id &&
        t.commissionBps !== null &&
        t.commissionPence !== null &&
        t.commissionVatBps !== null &&
        t.commissionVatPence !== null &&
        t.sellerNetPence !== null &&
        (t.commissionVatTreatment === "standard" || t.commissionVatTreatment === "not_registered");
      return {
        lineId: line.lineId,
        paymentId: line.paymentId as string,
        lotId: line.lotId,
        lotNumber: line.lotNumber,
        lotTitle: line.lotTitle,
        amount: money(line.amount),
        terms:
          priced && t
            ? {
                hammerPence: t.hammerPence as number,
                commissionBps: t.commissionBps as number,
                commissionPence: t.commissionPence as number,
                commissionVatTreatment: t.commissionVatTreatment as "standard" | "not_registered",
                commissionVatBps: t.commissionVatBps as number,
                commissionVatPence: t.commissionVatPence as number,
                sellerNetPence: t.sellerNetPence as number,
              }
            : null,
        oldRule: priced
          ? null
          : { paymentAmount: money(line.paymentAmount), platformFee: money(line.platformFee) },
        // The agreement the sale was priced on, flagged when that row changed since.
        agreement:
          priced && t?.agreementId && snapshotAgreements.has(t.agreementId)
            ? this.versioned(snapshotAgreements.get(t.agreementId), t)
            : (agreements.get(line.lotId) ?? null),
      };
    });

    return {
      payout: {
        id: row.id,
        legalEntityId: row.legalEntityId,
        status: row.status,
        createdAt: row.createdAt,
        processedAt: row.processedAt,
        grossAmount: money(row.grossAmount),
        platformFee: money(row.platformFee),
        stripeFee: money(row.stripeFee),
        netAmount: money(row.netAmount),
        hammerAmount: row.hammerAmount === null ? null : money(row.hammerAmount),
        commissionAmount: row.commissionAmount === null ? null : money(row.commissionAmount),
        commissionVatAmount:
          row.commissionVatAmount === null ? null : money(row.commissionVatAmount),
      },
      sales,
      heldForSeller,
    };
  }

  async oldRuleSales(page: { limit: number; offset: number }): Promise<{
    rows: StaffOldRuleSale[];
    total: number;
  }> {
    const where = and(
      eq(payoutLine.kind, "sale"),
      isNull(payoutLine.sellerTermsId),
      eq(payout.status, "paid"),
    );
    const [rows, totals] = await Promise.all([
      this.db
        .select({
          lineId: payoutLine.id,
          payoutId: payout.id,
          payoutCreatedAt: payout.createdAt,
          paidAt: payout.processedAt,
          legalEntityId: payout.legalEntityId,
          sellerName: legalEntity.displayName,
          lotId: payment.lotId,
          lotNumber: lot.lotNumber,
          lotTitle: lot.title,
          paymentAmount: payment.amount,
          platformFee: payment.platformFee,
          hammerPence: sql<number | null>`(
            select sum(${bidInvoiceLine.amountPence})::bigint from ${bidInvoiceLine}
            where ${bidInvoiceLine.invoiceId} = ${payment.invoiceId}
              and ${bidInvoiceLine.kind} = 'hammer'
          )`.mapWith((v) => (v === null ? null : Number(v))),
        })
        .from(payoutLine)
        .innerJoin(payout, eq(payout.id, payoutLine.payoutId))
        .innerJoin(payment, eq(payment.id, payoutLine.paymentId))
        .innerJoin(lot, eq(lot.id, payment.lotId))
        .leftJoin(legalEntity, eq(legalEntity.id, payout.legalEntityId))
        .where(where)
        .orderBy(desc(payout.processedAt), desc(payoutLine.createdAt))
        .limit(page.limit)
        .offset(page.offset),
      this.db
        .select({ total: count() })
        .from(payoutLine)
        .innerJoin(payout, eq(payout.id, payoutLine.payoutId))
        .where(where),
    ]);
    const agreements = await this.agreementsFor(rows.map((row) => row.lotId));
    return {
      total: Number(totals[0]?.total ?? 0),
      rows: rows.map((row) => ({
        ...row,
        sellerName: row.sellerName ?? null,
        paymentAmount: money(row.paymentAmount),
        platformFee: money(row.platformFee),
        agreement: agreements.get(row.lotId) ?? null,
      })),
    };
  }

  /** The agreements some sales were priced on, by id, with when each row last changed. */
  private async agreementsById(
    ids: readonly string[],
  ): Promise<Map<string, StaffLineAgreement & { updatedAt: Date }>> {
    const byId = new Map<string, StaffLineAgreement & { updatedAt: Date }>();
    if (ids.length === 0) return byId;
    const rows = await this.db
      .select({
        id: consignmentAgreement.id,
        referenceNumber: itemSubmission.referenceNumber,
        submissionId: itemSubmission.id,
        acceptedAt: consignmentAgreement.acceptedAt,
        source: consignmentAgreement.source,
        commissionPercent: consignmentAgreement.commissionPercent,
        updatedAt: consignmentAgreement.updatedAt,
      })
      .from(consignmentAgreement)
      .innerJoin(itemSubmission, eq(itemSubmission.id, consignmentAgreement.submissionId))
      .where(inArray(consignmentAgreement.id, [...new Set(ids)]));
    for (const row of rows) {
      byId.set(row.id, {
        reference: consignmentReference(row.referenceNumber),
        submissionId: row.submissionId,
        signedAt: row.acceptedAt ?? null,
        source: row.source === "recorded" ? "recorded" : "online",
        commissionPercent: row.commissionPercent === null ? null : String(row.commissionPercent),
        pricedOnEarlierVersion: false,
        updatedAt: row.updatedAt,
      });
    }
    return byId;
  }

  private versioned(
    found: (StaffLineAgreement & { updatedAt: Date }) | undefined,
    terms: { commissionBps: number | null; computedAt: Date | null },
  ): StaffLineAgreement | null {
    if (!found) return null;
    const { updatedAt, ...agreement } = found;
    return {
      ...agreement,
      pricedOnEarlierVersion:
        terms.computedAt !== null &&
        pricedOnEarlierVersion(
          { commissionBps: terms.commissionBps, computedAt: terms.computedAt },
          { commissionPercent: agreement.commissionPercent, updatedAt },
        ),
    };
  }

  /** The agreement behind each lot: the lot seller's own first, then an accepted one. */
  private async agreementsFor(lotIds: readonly string[]): Promise<Map<string, StaffLineAgreement>> {
    const byLot = new Map<string, StaffLineAgreement>();
    if (lotIds.length === 0) return byLot;
    const rows = await this.db
      .select({
        lotId: itemSubmission.convertedLotId,
        referenceNumber: itemSubmission.referenceNumber,
        submissionId: itemSubmission.id,
        acceptedAt: consignmentAgreement.acceptedAt,
        source: consignmentAgreement.source,
        commissionPercent: consignmentAgreement.commissionPercent,
      })
      .from(itemSubmission)
      .innerJoin(consignmentAgreement, eq(consignmentAgreement.submissionId, itemSubmission.id))
      .innerJoin(lot, eq(lot.id, itemSubmission.convertedLotId))
      .where(inArray(itemSubmission.convertedLotId, [...new Set(lotIds)]))
      .orderBy(
        desc(sql`${consignmentAgreement.legalEntityId} = ${lot.sellerLegalEntityId}`),
        sql`${consignmentAgreement.acceptedAt} is null`,
        desc(consignmentAgreement.acceptedAt),
      );
    for (const row of rows) {
      if (!row.lotId || byLot.has(row.lotId)) continue;
      byLot.set(row.lotId, {
        reference: consignmentReference(row.referenceNumber),
        submissionId: row.submissionId,
        signedAt: row.acceptedAt ?? null,
        source: row.source === "recorded" ? "recorded" : "online",
        commissionPercent: row.commissionPercent === null ? null : String(row.commissionPercent),
        pricedOnEarlierVersion: false,
      });
    }
    return byLot;
  }

  heldSales(limit: number): Promise<StaffHeldSale[]> {
    return this.heldFor(null, limit);
  }

  /** Captured sales held for a missing fact and on no payout yet: one seller's, or everyone's. */
  private async heldFor(legalEntityId: string | null, limit = 500): Promise<StaffHeldSale[]> {
    const rows = await this.db
      .select({
        paymentId: saleSellerTerms.paymentId,
        sellerLegalEntityId: saleSellerTerms.sellerLegalEntityId,
        sellerName: legalEntity.displayName,
        lotId: saleSellerTerms.lotId,
        lotNumber: lot.lotNumber,
        lotTitle: lot.title,
        heldReason: saleSellerTerms.heldReason,
        hammerPence: saleSellerTerms.hammerPence,
      })
      .from(saleSellerTerms)
      .innerJoin(payment, eq(payment.id, saleSellerTerms.paymentId))
      .innerJoin(lot, eq(lot.id, saleSellerTerms.lotId))
      .leftJoin(legalEntity, eq(legalEntity.id, saleSellerTerms.sellerLegalEntityId))
      .where(
        and(
          legalEntityId ? eq(saleSellerTerms.sellerLegalEntityId, legalEntityId) : undefined,
          eq(saleSellerTerms.basis, "held"),
          eq(payment.status, "captured"),
          notExists(
            this.db
              .select({ id: payoutLine.id })
              .from(payoutLine)
              .where(and(eq(payoutLine.paymentId, payment.id), eq(payoutLine.kind, "sale"))),
          ),
        ),
      )
      .orderBy(asc(saleSellerTerms.computedAt), asc(lot.lotNumber))
      .limit(limit);
    return rows.map((row) => ({
      ...row,
      sellerName: row.sellerName ?? null,
      heldReason: (row.heldReason ?? "no_agreement") as SellerTermsHeldReason,
    }));
  }
}
