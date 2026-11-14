import type {
  BidBuyerFacts,
  BidGroupDeliveryFacts,
  BidGroupMemberFacts,
  BidInvoiceFacts,
  BidPaidInvoiceFacts,
  BidPaymentFacts,
  BidPaymentGroupFacts,
  BidRefundsFacts,
} from "@auction/accounting-domain";
import { LONDON_TIME_ZONE, dayKey } from "@auction/datetime";
import type { Database } from "@auction/db";
import {
  bidInvoice,
  bidInvoiceLine,
  legalEntity,
  legalEntityInvoiceDetails,
  payment,
  paymentGroup,
  paymentGroupDelivery,
  paymentRefund,
} from "@auction/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { FactsRead, IBidAccountingFactsReader } from "../../interfaces/accounting.js";

const skip = (reason: string) => ({ status: "skip", reason }) as const;
const ready = <T>(facts: T) => ({ status: "ready", facts }) as const;
const londonDay = (instant: Date) => dayKey(instant, LONDON_TIME_ZONE);
/** numeric(18,2) pounds to whole pence in the database: exact, no floating point. */
const pence = (column: AnyPgColumn) => sql<string>`(${column} * 100)::bigint`;

/**
 * Every Bid payment is taken in pounds: the payment row holds no currency of its own (the checkout
 * and the bank-transfer instructions are created in GBP). A "Pay several" group stores its own.
 */
const BID_PAYMENT_CURRENCY = "GBP";

/**
 * The stored Bid rows behind each accounting flow. Read-only. The invoice is read from its own
 * rows every time, so every flow that names it projects the identical invoice document.
 */
export class DrizzleBidAccountingFactsReader implements IBidAccountingFactsReader {
  constructor(private readonly db: Database) {}

  async invoiceRaised(invoiceId: string): Promise<FactsRead<BidInvoiceFacts>> {
    const read = await this.paidInvoice(invoiceId);
    if (read.status === "skip") return read;
    // A cancelled invoice is booked by the buyer-default flow, which is not built yet.
    if ("cancelled" in read.facts) return skip("invoice_voided");
    return ready(read.facts);
  }

  /**
   * The invoice as it stands now: raised with its stored lines, or (once voided) only who it was
   * for, so a payment taken for it can still be named and parked for a person.
   */
  private async paidInvoice(invoiceId: string): Promise<FactsRead<BidPaidInvoiceFacts>> {
    const [row] = await this.db
      .select({
        id: bidInvoice.id,
        raisedAt: bidInvoice.raisedAt,
        dueAt: bidInvoice.dueAt,
        voidedAt: bidInvoice.voidedAt,
        buyerLegalEntityId: bidInvoice.buyerLegalEntityId,
      })
      .from(bidInvoice)
      .where(eq(bidInvoice.id, invoiceId));
    if (!row) return skip("invoice_not_found");
    const buyer = await this.buyer(row.buyerLegalEntityId);
    if (!buyer) return skip("invoice_not_found");
    if (row.voidedAt !== null) {
      return ready({ invoiceId: row.id.toLowerCase(), buyer, cancelled: true as const });
    }
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
      buyer,
      raisedOn: londonDay(row.raisedAt),
      dueOn: londonDay(row.dueAt),
      lines,
    });
  }

  /** The buyer account as the books name it: one contact per account. */
  private async buyer(legalEntityId: string): Promise<BidBuyerFacts | null> {
    const [row] = await this.db
      .select({
        id: legalEntity.id,
        displayName: legalEntity.displayName,
        legalName: legalEntity.legalName,
        billingEmail: legalEntityInvoiceDetails.billingEmail,
      })
      .from(legalEntity)
      .leftJoin(
        legalEntityInvoiceDetails,
        eq(legalEntityInvoiceDetails.legalEntityId, legalEntity.id),
      )
      .where(eq(legalEntity.id, legalEntityId));
    if (!row) return null;
    return {
      legalEntityId: row.id.toLowerCase(),
      name: row.legalName?.trim() || row.displayName,
      email: row.billingEmail ?? null,
    };
  }

  async paymentCaptured(paymentId: string, capturedAt: Date): Promise<FactsRead<BidPaymentFacts>> {
    const found = await this.payment(paymentId);
    if (found.status === "skip") return found;
    const invoice = await this.paidInvoice(found.facts.invoiceId);
    if (invoice.status === "skip") return invoice;
    return ready({
      paymentId: found.facts.id,
      invoice: invoice.facts,
      amountPence: found.facts.amountPence,
      currency: BID_PAYMENT_CURRENCY,
      capturedOn: londonDay(capturedAt),
    });
  }

  async paymentGroupSettled(groupId: string): Promise<FactsRead<BidPaymentGroupFacts>> {
    const [group] = await this.db
      .select({
        id: paymentGroup.id,
        status: paymentGroup.status,
        currency: paymentGroup.currency,
        buyerLegalEntityId: paymentGroup.buyerLegalEntityId,
        totalPence: pence(paymentGroup.totalAmount),
        settledAt: paymentGroup.settledAt,
      })
      .from(paymentGroup)
      .where(eq(paymentGroup.id, groupId));
    if (!group) return skip("payment_group_not_found");
    if (group.status !== "paid" || group.settledAt === null) return skip("payment_group_not_paid");
    const buyer = await this.buyer(group.buyerLegalEntityId);
    if (!buyer) return skip("payment_group_buyer_not_found");

    const memberRows = await this.db
      .select({ id: payment.id, invoiceId: payment.invoiceId, amountPence: pence(payment.amount) })
      .from(payment)
      .where(eq(payment.paymentGroupId, group.id))
      .orderBy(asc(payment.id));
    const members: BidGroupMemberFacts[] = [];
    for (const row of memberRows) {
      if (row.invoiceId === null) return skip("payment_without_invoice");
      const invoice = await this.paidInvoice(row.invoiceId);
      if (invoice.status === "skip") return invoice;
      members.push({
        paymentId: row.id.toLowerCase(),
        amountPence: Number(row.amountPence),
        invoice: invoice.facts,
      });
    }
    const deliveries: BidGroupDeliveryFacts[] = (
      await this.db
        .select({
          quoteId: paymentGroupDelivery.deliveryQuoteId,
          amountPence: pence(paymentGroupDelivery.amount),
        })
        .from(paymentGroupDelivery)
        .where(eq(paymentGroupDelivery.paymentGroupId, group.id))
        .orderBy(asc(paymentGroupDelivery.deliveryQuoteId))
    ).map((row) => ({ quoteId: row.quoteId.toLowerCase(), amountPence: Number(row.amountPence) }));

    return ready({
      groupId: group.id.toLowerCase(),
      buyer,
      currency: group.currency,
      totalPence: Number(group.totalPence),
      settledOn: londonDay(group.settledAt),
      members,
      deliveries,
    });
  }

  async deliveryGroupOf(quoteId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ groupId: paymentGroupDelivery.paymentGroupId })
      .from(paymentGroupDelivery)
      .where(eq(paymentGroupDelivery.deliveryQuoteId, quoteId));
    return row ? row.groupId.toLowerCase() : null;
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

  /** One payment of one invoice. A "Pay several" member is booked by the group's own flow. */
  private async payment(
    paymentId: string,
  ): Promise<FactsRead<{ id: string; invoiceId: string; amountPence: number }>> {
    const [row] = await this.db
      .select({
        id: payment.id,
        invoiceId: payment.invoiceId,
        paymentGroupId: payment.paymentGroupId,
        amountPence: pence(payment.amount),
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
