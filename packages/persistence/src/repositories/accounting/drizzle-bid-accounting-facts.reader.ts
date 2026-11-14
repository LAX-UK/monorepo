import type {
  BidBuyerFacts,
  BidDeliveryRefundFacts,
  BidGroupDeliveryFacts,
  BidGroupMemberFacts,
  BidInvoiceFacts,
  BidPaidInvoiceFacts,
  BidPaymentFacts,
  BidPaymentGroupFacts,
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
import { and, asc, eq, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type {
  BidPaymentRefundsRead,
  FactsRead,
  IBidAccountingFactsReader,
} from "../../interfaces/accounting.js";

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
    return ready({
      invoiceId: row.id.toLowerCase(),
      buyer,
      raisedOn: londonDay(row.raisedAt),
      dueOn: londonDay(row.dueAt),
      lines: await this.linesOf(row.id),
    });
  }

  /** An invoice's frozen lines, in their order. */
  private linesOf(invoiceId: string) {
    return this.db
      .select({
        id: bidInvoiceLine.id,
        kind: bidInvoiceLine.kind,
        label: bidInvoiceLine.label,
        amountPence: bidInvoiceLine.amountPence,
      })
      .from(bidInvoiceLine)
      .where(eq(bidInvoiceLine.invoiceId, invoiceId))
      .orderBy(asc(bidInvoiceLine.position));
  }

  async defaultedInvoice(
    paymentId: string,
  ): Promise<FactsRead<{ readonly invoice: BidInvoiceFacts; readonly defaultedOn: string }>> {
    const [paid] = await this.db
      .select({ invoiceId: payment.invoiceId })
      .from(payment)
      .where(eq(payment.id, paymentId));
    if (!paid) return skip("payment_not_found");
    if (paid.invoiceId === null) return skip("payment_without_invoice");
    return this.voidedInvoice(paid.invoiceId);
  }

  async voidedInvoice(
    invoiceId: string,
  ): Promise<FactsRead<{ readonly invoice: BidInvoiceFacts; readonly defaultedOn: string }>> {
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
    // Only a voided invoice is undone; one that stands (the default was reversed) is left alone.
    if (row.voidedAt === null) return skip("invoice_not_voided");
    const buyer = await this.buyer(row.buyerLegalEntityId);
    if (!buyer) return skip("invoice_not_found");
    return ready({
      invoice: {
        invoiceId: row.id.toLowerCase(),
        buyer,
        raisedOn: londonDay(row.raisedAt),
        dueOn: londonDay(row.dueAt),
        lines: await this.linesOf(row.id),
      },
      defaultedOn: londonDay(row.voidedAt),
    });
  }

  async deliveryRefunded(
    groupId: string,
    quoteId: string,
    refundedAt: Date,
  ): Promise<FactsRead<BidDeliveryRefundFacts>> {
    const [group] = await this.db
      .select({
        id: paymentGroup.id,
        status: paymentGroup.status,
        currency: paymentGroup.currency,
        buyerLegalEntityId: paymentGroup.buyerLegalEntityId,
        settledAt: paymentGroup.settledAt,
      })
      .from(paymentGroup)
      .where(eq(paymentGroup.id, groupId));
    if (!group) return skip("payment_group_not_found");
    if (group.settledAt === null) return skip("payment_group_not_paid");
    if (group.currency !== BID_PAYMENT_CURRENCY) return skip("refund_not_in_pounds");
    const [delivery] = await this.db
      .select({
        quoteId: paymentGroupDelivery.deliveryQuoteId,
        chargedPence: pence(paymentGroupDelivery.amount),
        refundedPence: paymentGroupDelivery.refundedPence,
      })
      .from(paymentGroupDelivery)
      .where(
        and(
          eq(paymentGroupDelivery.paymentGroupId, group.id),
          eq(paymentGroupDelivery.deliveryQuoteId, quoteId),
        ),
      );
    if (!delivery) return skip("delivery_not_in_group");
    const buyer = await this.buyer(group.buyerLegalEntityId);
    if (!buyer) return skip("payment_group_buyer_not_found");
    return ready({
      groupId: group.id.toLowerCase(),
      buyer,
      quoteId: delivery.quoteId.toLowerCase(),
      chargedPence: Number(delivery.chargedPence),
      settledOn: londonDay(group.settledAt),
      refundedPence: delivery.refundedPence,
      refundedOn: londonDay(refundedAt),
      priorCredits: [],
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

  async paymentRefunded(paymentId: string): Promise<FactsRead<BidPaymentRefundsRead>> {
    const [row] = await this.db
      .select({
        id: payment.id,
        invoiceId: payment.invoiceId,
        amountPence: pence(payment.amount),
      })
      .from(payment)
      .where(eq(payment.id, paymentId));
    if (!row) return skip("payment_not_found");
    if (row.invoiceId === null) return skip("payment_without_invoice");
    // A "Pay several" member's own row holds what the charge took for its invoice, so a lot's
    // refund is credited against exactly that, like a payment of its own.
    const invoice = await this.invoiceRaised(row.invoiceId);
    if (invoice.status === "skip") return invoice;
    const rows = await this.db
      .select({
        id: paymentRefund.id,
        amountPence: paymentRefund.amountPence,
        currency: paymentRefund.currency,
        source: paymentRefund.source,
        stripeRefundId: paymentRefund.stripeRefundId,
        createdAt: paymentRefund.createdAt,
      })
      .from(paymentRefund)
      .where(eq(paymentRefund.paymentId, row.id))
      .orderBy(asc(paymentRefund.createdAt), asc(paymentRefund.id));
    if (rows.some((r) => r.currency !== "GBP")) return skip("refund_not_in_pounds");
    const kept = withoutReversed(rows);
    if (kept === null) return skip("refund_reversal_unmatched");
    if (kept.length === 0) return skip("no_refund_recorded");
    return ready({
      invoice: invoice.facts,
      refundRows: rows.length,
      paidPence: Number(row.amountPence),
      refunds: kept.map((r) => ({
        refundId: r.id.toLowerCase(),
        amountPence: r.amountPence,
        refundedOn: londonDay(r.createdAt),
      })),
    });
  }

  async paymentRefundReversals(
    paymentId: string,
  ): Promise<
    FactsRead<{ readonly invoiceId: string; readonly reversedRefundIds: readonly string[] }>
  > {
    const [row] = await this.db
      .select({ id: payment.id, invoiceId: payment.invoiceId })
      .from(payment)
      .where(eq(payment.id, paymentId));
    if (!row) return skip("payment_not_found");
    if (row.invoiceId === null) return skip("payment_without_invoice");
    const rows = await this.db
      .select({
        id: paymentRefund.id,
        amountPence: paymentRefund.amountPence,
        source: paymentRefund.source,
        stripeRefundId: paymentRefund.stripeRefundId,
      })
      .from(paymentRefund)
      .where(eq(paymentRefund.paymentId, row.id))
      .orderBy(asc(paymentRefund.createdAt), asc(paymentRefund.id));
    const kept = withoutReversed(rows);
    if (kept === null) return skip("refund_reversal_unmatched");
    const keptIds = new Set(kept.map((r) => r.id));
    const reversedRefundIds = rows
      .filter((r) => r.source !== "refund_reversal" && !keptIds.has(r.id))
      .map((r) => r.id.toLowerCase());
    if (reversedRefundIds.length === 0) return skip("no_refund_reversed");
    return ready({ invoiceId: row.invoiceId.toLowerCase(), reversedRefundIds });
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

interface RefundRow {
  readonly id: string;
  readonly amountPence: number;
  readonly source: string;
  readonly stripeRefundId: string | null;
}

/**
 * The refunds that went through and stayed: each `refund_reversal` row takes back a refund of the
 * same Stripe refund id, for exactly its amount (the latest such row first), and both are left
 * out. A reversal that matches no refund of the payment exactly answers null: it cannot be told
 * which credit it undoes, so a person decides.
 */
function withoutReversed<T extends RefundRow>(rows: readonly T[]): T[] | null {
  const kept = rows.filter((r) => r.source !== "refund_reversal");
  for (const reversal of rows.filter((r) => r.source === "refund_reversal")) {
    let index = -1;
    for (let i = kept.length - 1; i >= 0; i -= 1) {
      const candidate = kept[i] as T;
      if (
        reversal.stripeRefundId !== null &&
        candidate.stripeRefundId === reversal.stripeRefundId &&
        candidate.amountPence === -reversal.amountPence
      ) {
        index = i;
        break;
      }
    }
    if (index < 0) return null;
    kept.splice(index, 1);
  }
  return kept;
}
