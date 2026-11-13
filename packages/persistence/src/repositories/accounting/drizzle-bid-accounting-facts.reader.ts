import type { BidInvoiceFacts, BidPaymentFacts, BidRefundsFacts } from "@auction/accounting-domain";
import { LONDON_TIME_ZONE, dayKey } from "@auction/datetime";
import type { Database } from "@auction/db";
import {
  bidInvoice,
  bidInvoiceLine,
  legalEntity,
  legalEntityInvoiceDetails,
  payment,
  paymentRefund,
} from "@auction/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import type { FactsRead, IBidAccountingFactsReader } from "../../interfaces/accounting.js";

const skip = (reason: string) => ({ status: "skip", reason }) as const;
const ready = <T>(facts: T) => ({ status: "ready", facts }) as const;
const londonDay = (instant: Date) => dayKey(instant, LONDON_TIME_ZONE);

/**
 * The stored Bid rows behind each accounting flow. Read-only. The invoice is read from its own
 * rows every time, so every flow that names it projects the identical invoice document.
 */
export class DrizzleBidAccountingFactsReader implements IBidAccountingFactsReader {
  constructor(private readonly db: Database) {}

  async invoiceRaised(invoiceId: string): Promise<FactsRead<BidInvoiceFacts>> {
    const [row] = await this.db
      .select({
        id: bidInvoice.id,
        raisedAt: bidInvoice.raisedAt,
        dueAt: bidInvoice.dueAt,
        voidedAt: bidInvoice.voidedAt,
        buyerLegalEntityId: bidInvoice.buyerLegalEntityId,
        displayName: legalEntity.displayName,
        legalName: legalEntity.legalName,
        billingEmail: legalEntityInvoiceDetails.billingEmail,
      })
      .from(bidInvoice)
      .innerJoin(legalEntity, eq(legalEntity.id, bidInvoice.buyerLegalEntityId))
      .leftJoin(
        legalEntityInvoiceDetails,
        eq(legalEntityInvoiceDetails.legalEntityId, bidInvoice.buyerLegalEntityId),
      )
      .where(eq(bidInvoice.id, invoiceId));
    if (!row) return skip("invoice_not_found");
    // A cancelled invoice is booked by the buyer-default flow, which is not built yet.
    if (row.voidedAt !== null) return skip("invoice_voided");
    const lines = await this.db
      .select({
        id: bidInvoiceLine.id,
        kind: bidInvoiceLine.kind,
        label: bidInvoiceLine.label,
        amountPence: bidInvoiceLine.amountPence,
      })
      .from(bidInvoiceLine)
      .where(eq(bidInvoiceLine.invoiceId, row.id))
      .orderBy(asc(bidInvoiceLine.position));
    return ready({
      invoiceId: row.id.toLowerCase(),
      buyer: {
        legalEntityId: row.buyerLegalEntityId.toLowerCase(),
        name: row.legalName?.trim() || row.displayName,
        email: row.billingEmail ?? null,
      },
      raisedOn: londonDay(row.raisedAt),
      dueOn: londonDay(row.dueAt),
      lines,
    });
  }

  async paymentCaptured(paymentId: string, capturedAt: Date): Promise<FactsRead<BidPaymentFacts>> {
    const found = await this.payment(paymentId);
    if (found.status === "skip") return found;
    const invoice = await this.invoiceRaised(found.facts.invoiceId);
    if (invoice.status === "skip") return invoice;
    return ready({
      paymentId: found.facts.id,
      invoice: invoice.facts,
      amountPence: found.facts.amountPence,
      capturedOn: londonDay(capturedAt),
    });
  }

  async paymentRefunded(paymentId: string): Promise<FactsRead<BidRefundsFacts>> {
    const found = await this.payment(paymentId);
    if (found.status === "skip") return found;
    const invoice = await this.invoiceRaised(found.facts.invoiceId);
    if (invoice.status === "skip") return invoice;
    const refunds = await this.db
      .select({
        id: paymentRefund.id,
        amountPence: paymentRefund.amountPence,
        currency: paymentRefund.currency,
        createdAt: paymentRefund.createdAt,
      })
      .from(paymentRefund)
      .where(eq(paymentRefund.paymentId, found.facts.id))
      .orderBy(asc(paymentRefund.createdAt), asc(paymentRefund.id));
    if (refunds.length === 0) return skip("no_refund_recorded");
    if (refunds.some((r) => r.currency !== "GBP")) return skip("refund_not_in_pounds");
    return ready({
      invoice: invoice.facts,
      paidPence: found.facts.amountPence,
      refunds: refunds.map((r) => ({
        refundId: r.id.toLowerCase(),
        amountPence: r.amountPence,
        refundedOn: londonDay(r.createdAt),
      })),
    });
  }

  /** One payment of one invoice. A "Pay several" member is booked by the group flow, not built yet. */
  private async payment(
    paymentId: string,
  ): Promise<FactsRead<{ id: string; invoiceId: string; amountPence: number }>> {
    const [row] = await this.db
      .select({
        id: payment.id,
        invoiceId: payment.invoiceId,
        paymentGroupId: payment.paymentGroupId,
        // numeric(18,2) to whole pence in the database: exact, no floating point.
        amountPence: sql<string>`(${payment.amount} * 100)::bigint`,
      })
      .from(payment)
      .where(eq(payment.id, paymentId));
    if (!row) return skip("payment_not_found");
    if (row.paymentGroupId !== null) return skip("payment_in_group");
    if (row.invoiceId === null) return skip("payment_without_invoice");
    return ready({
      id: row.id.toLowerCase(),
      invoiceId: row.invoiceId,
      amountPence: Number(row.amountPence),
    });
  }
}
