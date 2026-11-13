import type { Database } from "@auction/db";
import {
  atgLotLink,
  bidInvoice,
  bidInvoiceLine,
  consignmentAgreement,
  domainEvent,
  itemSubmission,
  legalEntity,
  lot,
  lotReoffer,
  payment,
  payout,
  payoutLine,
  saleSellerTerms,
} from "@auction/db/schema";
import { type SellerTermsHeldReason, consignmentReference } from "@auction/domain";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type {
  IStaffLotSellerProceedsReader,
  IStaffSaleLabelsReader,
  StaffAgreementFacts,
  StaffInvoiceFacts,
  StaffLotSaleFacts,
  StaffLotSellerProceedsFacts,
  StaffSaleLabel,
  StaffSellerTermsFacts,
  StaffSellerTermsSource,
} from "../interfaces/staff-seller-proceeds.reader.js";
import { DrizzleCommissionVatSettingReader } from "./drizzle-seller-terms-facts.reader.js";

/** The audit event that records an ATG sale settled with its seller outside LAX. */
export const SETTLED_OUTSIDE_EVENT = "lot.seller_settled_outside_lax";

/** Payments that still stand for a sale; a cancelled one was replaced or never taken. */
const LIVE_PAYMENT = ["pending", "authorized", "captured", "requires_manual_review", "refunded"];

type TermsRow = typeof saleSellerTerms.$inferSelect;

function termsFacts(row: TermsRow): StaffSellerTermsFacts {
  return {
    id: row.id,
    basis: row.basis as StaffSellerTermsFacts["basis"],
    heldReason: (row.heldReason as SellerTermsHeldReason | null) ?? null,
    source: row.source as StaffSellerTermsSource,
    hammerPence: row.hammerPence,
    premiumPence: row.premiumPence,
    commissionBps: row.commissionBps,
    commissionPence: row.commissionPence,
    commissionVatTreatment:
      row.commissionVatTreatment === "standard" || row.commissionVatTreatment === "not_registered"
        ? row.commissionVatTreatment
        : null,
    commissionVatBps: row.commissionVatBps,
    commissionVatPence: row.commissionVatPence,
    sellerNetPence: row.sellerNetPence,
    legacyPlatformFeePence: row.legacyPlatformFeePence,
    computedAt: row.computedAt,
  };
}

const AGREEMENT_COLUMNS = {
  id: consignmentAgreement.id,
  submissionId: consignmentAgreement.submissionId,
  referenceNumber: itemSubmission.referenceNumber,
  legalEntityId: consignmentAgreement.legalEntityId,
  acceptedAt: consignmentAgreement.acceptedAt,
  commissionPercent: consignmentAgreement.commissionPercent,
  source: consignmentAgreement.source,
} as const;

type AgreementRow = {
  id: string;
  submissionId: string;
  referenceNumber: number;
  legalEntityId: string;
  acceptedAt: Date | null;
  commissionPercent: string | null;
  source: string;
};

function agreementFacts(row: AgreementRow): StaffAgreementFacts {
  return {
    id: row.id,
    submissionId: row.submissionId,
    reference: consignmentReference(row.referenceNumber),
    legalEntityId: row.legalEntityId,
    signedAt: row.acceptedAt ?? null,
    commissionPercent: row.commissionPercent === null ? null : String(row.commissionPercent),
    source: row.source === "recorded" ? "recorded" : "online",
  };
}

/**
 * The seller's side of one lot for staff screens: the live sale's snapshot, the buyer's frozen
 * invoice (premium line and total), the payout it was paid on, and the agreement behind it.
 * Every figure is read as stored; nothing is priced here.
 */
export class DrizzleStaffLotSellerProceedsReader
  implements IStaffLotSellerProceedsReader, IStaffSaleLabelsReader
{
  constructor(private readonly db: Database) {}

  async forLot(lotId: string): Promise<StaffLotSellerProceedsFacts | null> {
    const [lotRow] = await this.db
      .select({
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        lotTitle: lot.title,
        sellerLegalEntityId: lot.sellerLegalEntityId,
        sellerName: legalEntity.displayName,
        atgSold: atgLotLink.sold,
      })
      .from(lot)
      .leftJoin(legalEntity, eq(legalEntity.id, lot.sellerLegalEntityId))
      .leftJoin(atgLotLink, eq(atgLotLink.lotId, lot.id))
      .where(eq(lot.id, lotId))
      .limit(1);
    if (!lotRow) return null;

    const [sale, submission, vatSetting, settledOutsideAt] = await Promise.all([
      this.liveSale(lotId),
      this.submissionAgreement(lotId, lotRow.sellerLegalEntityId),
      new DrizzleCommissionVatSettingReader(this.db).read(),
      lotRow.atgSold === true ? this.settledOutsideAt(lotId) : Promise.resolve(null),
    ]);
    const snapshotAgreementId = sale?.agreementId ?? null;
    const agreement =
      snapshotAgreementId && snapshotAgreementId !== submission.agreement?.id
        ? await this.agreementById(snapshotAgreementId)
        : submission.agreement;

    return {
      lotId: lotRow.lotId,
      lotNumber: lotRow.lotNumber,
      lotTitle: lotRow.lotTitle,
      sellerLegalEntityId: lotRow.sellerLegalEntityId,
      sellerName: lotRow.sellerName ?? null,
      soldOnAtg: lotRow.atgSold === true,
      settledOutsideAt,
      sale: sale?.facts ?? null,
      agreement,
      submissionId: submission.submissionId,
      vatSetting,
    };
  }

  async saleLabels(lotIds: readonly string[]): Promise<StaffSaleLabel[]> {
    if (lotIds.length === 0) return [];
    const ids = [...new Set(lotIds)];
    const [lots, agreements] = await Promise.all([
      this.db
        .select({ lotId: lot.id, lotNumber: lot.lotNumber, lotTitle: lot.title })
        .from(lot)
        .where(inArray(lot.id, ids)),
      this.db
        .select({
          lotId: itemSubmission.convertedLotId,
          sellerMatches: sql<boolean>`${consignmentAgreement.legalEntityId} = ${lot.sellerLegalEntityId}`,
          agreement: AGREEMENT_COLUMNS,
        })
        .from(itemSubmission)
        .innerJoin(consignmentAgreement, eq(consignmentAgreement.submissionId, itemSubmission.id))
        .innerJoin(lot, eq(lot.id, itemSubmission.convertedLotId))
        .where(inArray(itemSubmission.convertedLotId, ids))
        .orderBy(
          desc(sql`${consignmentAgreement.legalEntityId} = ${lot.sellerLegalEntityId}`),
          sql`${consignmentAgreement.acceptedAt} is null`,
          desc(consignmentAgreement.acceptedAt),
        ),
    ]);
    const byLot = new Map<string, StaffAgreementFacts>();
    for (const row of agreements) {
      if (row.lotId && !byLot.has(row.lotId)) byLot.set(row.lotId, agreementFacts(row.agreement));
    }
    return lots.map((row) => {
      const agreement = byLot.get(row.lotId) ?? null;
      return {
        lotId: row.lotId,
        lotNumber: row.lotNumber,
        lotTitle: row.lotTitle,
        agreement: agreement
          ? {
              id: agreement.id,
              reference: agreement.reference,
              submissionId: agreement.submissionId,
              signedAt: agreement.signedAt,
              source: agreement.source,
            }
          : null,
      };
    });
  }

  /** The latest time staff marked the lot's ATG sale as settled outside LAX. */
  private async settledOutsideAt(lotId: string): Promise<Date | null> {
    const [row] = await this.db
      .select({ at: domainEvent.occurredAt })
      .from(domainEvent)
      .where(
        and(
          eq(domainEvent.aggregateType, "lot"),
          eq(domainEvent.aggregateId, lotId),
          eq(domainEvent.eventType, SETTLED_OUTSIDE_EVENT),
        ),
      )
      .orderBy(desc(domainEvent.occurredAt))
      .limit(1);
    return row?.at ?? null;
  }

  private async liveSale(
    lotId: string,
  ): Promise<{ facts: StaffLotSaleFacts; agreementId: string | null } | null> {
    const [row] = await this.db
      .select({
        paymentId: payment.id,
        paymentStatus: payment.status,
        invoiceId: payment.invoiceId,
        terms: saleSellerTerms,
        payoutId: payout.id,
        payoutStatus: payout.status,
        payoutProcessedAt: payout.processedAt,
      })
      .from(payment)
      .leftJoin(saleSellerTerms, eq(saleSellerTerms.paymentId, payment.id))
      .leftJoin(payoutLine, and(eq(payoutLine.paymentId, payment.id), eq(payoutLine.kind, "sale")))
      .leftJoin(payout, eq(payout.id, payoutLine.payoutId))
      .where(
        and(
          eq(payment.lotId, lotId),
          inArray(payment.status, LIVE_PAYMENT as (typeof payment.status.enumValues)[number][]),
        ),
      )
      .orderBy(desc(payment.createdAt))
      .limit(1);
    if (!row) return null;

    const [invoice, refundedAfterPayout, reawarded] = await Promise.all([
      row.invoiceId ? this.invoiceFacts(row.invoiceId) : Promise.resolve(null),
      this.hasRefundLine(row.paymentId),
      this.isReawarded(row.paymentId),
    ]);
    return {
      agreementId: row.terms?.agreementId ?? null,
      facts: {
        paymentId: row.paymentId,
        paymentStatus: row.paymentStatus,
        terms: row.terms ? termsFacts(row.terms) : null,
        invoice,
        payout:
          row.payoutId && row.payoutStatus
            ? { id: row.payoutId, status: row.payoutStatus, processedAt: row.payoutProcessedAt }
            : null,
        refundedAfterPayout,
        reawarded,
      },
    };
  }

  private async invoiceFacts(invoiceId: string): Promise<StaffInvoiceFacts | null> {
    const rows = await this.db
      .select({
        totalPence: bidInvoice.totalPence,
        kind: bidInvoiceLine.kind,
        ratePercent: bidInvoiceLine.ratePercent,
        amountPence: bidInvoiceLine.amountPence,
      })
      .from(bidInvoice)
      .leftJoin(bidInvoiceLine, eq(bidInvoiceLine.invoiceId, bidInvoice.id))
      .where(eq(bidInvoice.id, invoiceId));
    const first = rows[0];
    if (!first) return null;
    const premiumLines = rows.filter((r) => r.kind === "buyers_premium");
    const rates = new Set(
      premiumLines.map((r) => (r.ratePercent === null ? null : String(r.ratePercent))),
    );
    return {
      totalPence: first.totalPence,
      premiumPence: premiumLines.reduce((sum, r) => sum + (r.amountPence ?? 0), 0),
      // One stated rate, or none when lines differ (tiered) or do not state one.
      premiumRatePercent: rates.size === 1 ? ([...rates][0] ?? null) : null,
    };
  }

  private async hasRefundLine(paymentId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: payoutLine.id })
      .from(payoutLine)
      .where(
        and(
          eq(payoutLine.paymentId, paymentId),
          eq(payoutLine.kind, "refund"),
          sql`${payoutLine.amount} < 0`,
        ),
      )
      .limit(1);
    return row !== undefined;
  }

  private async isReawarded(paymentId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: lotReoffer.id })
      .from(lotReoffer)
      .where(and(eq(lotReoffer.paymentId, paymentId), sql`${lotReoffer.reawardedAt} is not null`))
      .limit(1);
    return row !== undefined;
  }

  private async submissionAgreement(
    lotId: string,
    sellerLegalEntityId: string | null,
  ): Promise<{ submissionId: string | null; agreement: StaffAgreementFacts | null }> {
    const [row] = await this.db
      .select({ submissionId: itemSubmission.id, agreement: AGREEMENT_COLUMNS })
      .from(itemSubmission)
      .leftJoin(consignmentAgreement, eq(consignmentAgreement.submissionId, itemSubmission.id))
      .where(eq(itemSubmission.convertedLotId, lotId))
      // The seller's own submission first, as the seller-terms rule reads it.
      .orderBy(
        sql`${itemSubmission.legalEntityId} <> ${sellerLegalEntityId ?? sql`${itemSubmission.legalEntityId}`}`,
        sql`${consignmentAgreement.acceptedAt} is null`,
        desc(itemSubmission.createdAt),
      )
      .limit(1);
    if (!row) return { submissionId: null, agreement: null };
    const agreement = row.agreement?.id ? agreementFacts(row.agreement as AgreementRow) : null;
    return { submissionId: row.submissionId, agreement };
  }

  private async agreementById(id: string): Promise<StaffAgreementFacts | null> {
    const [row] = await this.db
      .select(AGREEMENT_COLUMNS)
      .from(consignmentAgreement)
      .innerJoin(itemSubmission, eq(itemSubmission.id, consignmentAgreement.submissionId))
      .where(eq(consignmentAgreement.id, id))
      .limit(1);
    return row ? agreementFacts(row as AgreementRow) : null;
  }
}
