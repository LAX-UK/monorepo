import {
  type BuiltFlow,
  type CreditNote,
  type DefaultedInvoiceInBooks,
  type FlowFacts,
  PROJECTION_POLICIES,
  type Product,
  type Projection,
  type ProjectionCode,
  type ProjectionPolicy,
  type Result,
  laxReference,
} from "@auction/accounting-domain";
import type {
  FactsRead,
  IBidAccountingFactsReader,
  IShopAccountingFactsReader,
} from "@auction/persistence/interfaces";
import {
  invoiceRaisedPayloadSchemaV1,
  paymentCapturedPayloadSchemaV1,
  paymentGroupDeliveryRefundedPayloadSchemaV1,
  paymentGroupSettledPayloadSchemaV1,
  shopAccountingOrderPaidPayloadSchemaV1,
} from "@auction/types";
import { z } from "zod";

/** The part of a domain event the accounting projector reads. */
export interface AccountingEvent {
  readonly id: number;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly payload: unknown;
  /** When the event happened (the outbox row's time); a refund's day when its rows hold none. */
  readonly occurredAt?: Date;
}

export type RouteOutcome =
  | { readonly status: "skip"; readonly reason: string }
  | { readonly status: "ready"; readonly projection: Result<Projection, ProjectionCode> };

/**
 * What the books the switch aims at now already hold for a product (its current target): the
 * credit notes registered for an invoice, and where an invoice stands. A new credit note is built
 * after the ones already there, and a buyer default cancels or credits by the invoice's standing.
 */
export interface BooksView {
  creditNotesFor(invoiceReference: string): Promise<readonly CreditNote[]>;
  invoiceStanding(invoiceReference: string): Promise<DefaultedInvoiceInBooks>;
}

/** Where each product's facts are read from (the stored rows; events carry ids only). */
export interface AccountingFactsReaders {
  readonly bid: IBidAccountingFactsReader;
  readonly shop: IShopAccountingFactsReader;
  /** The books the product's documents go to now; absent where the projection gives none. */
  readonly books?: BooksView;
}

/** One event type's way into the books: which product, which flow, and how its facts are read. */
export interface AccountingEventRoute {
  readonly product: Product;
  readonly flow: BuiltFlow;
  project(facts: AccountingFactsReaders, event: AccountingEvent): Promise<RouteOutcome>;
}

/** Thrown when an event cannot be read as its contract says; the delivery is not retried. */
export class AccountingEventPayloadError extends Error {
  constructor(eventType: string) {
    super(`accounting_event_payload_invalid:${eventType}`);
    this.name = "AccountingEventPayloadError";
  }
}

/**
 * The invoice's stored lines are not the ones its `invoice.raised` event named. Not retried: a
 * person looks at the invoice (the lines are frozen at raise, so this should never happen).
 */
export class AccountingInvoiceLinesChangedError extends Error {
  readonly retryable = false;
  readonly code = "invoice_lines_changed";
  /** `invoiceId`: the Bid invoice, or the Shop order whose lines are its invoice's. */
  constructor(invoiceId: string) {
    super(`accounting_invoice_lines_changed:${invoiceId}`);
    this.name = "AccountingInvoiceLinesChangedError";
  }
}

/**
 * The settled group's stored payment and courier-quote rows are not the ones its
 * `payment_group.settled` event named. Not retried: a person looks at the group (they are fixed
 * by the settlement transaction, so this should never happen).
 */
export class AccountingGroupRowsChangedError extends Error {
  readonly retryable = false;
  readonly code = "payment_group_rows_changed";
  constructor(groupId: string) {
    super(`accounting_payment_group_rows_changed:${groupId}`);
    this.name = "AccountingGroupRowsChangedError";
  }
}

/**
 * A refund counted on a payment was taken back (a `refund_reversal` row) and cannot be matched to
 * the refund it undoes. Not retried: a person decides which credit note, if any, it undoes.
 */
export class AccountingRefundReversalUnmatchedError extends Error {
  readonly retryable = false;
  readonly code = "refund_reversal_unmatched";
  constructor(paymentId: string) {
    super(`accounting_refund_reversal_unmatched:${paymentId}`);
    this.name = "AccountingRefundReversalUnmatchedError";
  }
}

/** The projection was given no view of the books (a wiring fault): tried again later. */
export class AccountingBooksViewMissingError extends Error {
  readonly retryable = true;
  constructor(eventType: string) {
    super(`accounting_books_view_missing:${eventType}`);
    this.name = "AccountingBooksViewMissingError";
  }
}

/** `payment.cancelled` as the books read it: only a buyer default's says anything to them. */
const paymentCancelledPayload = z.object({ reason: z.string().optional() }).passthrough();

/** The same ids, in any order (case aside). */
function sameIds(named: readonly string[], stored: readonly string[]): boolean {
  const a = named.map((id) => id.toLowerCase()).sort();
  const b = stored.map((id) => id.toLowerCase()).sort();
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/** The lines read are exactly the raised ones, in the same order. */
function sameLines(raised: readonly string[], lines: readonly { readonly id?: string }[]): boolean {
  return (
    raised.length === lines.length &&
    raised.every((id, index) => id.toLowerCase() === lines[index]?.id?.toLowerCase())
  );
}

function route<F extends BuiltFlow>(
  product: Product,
  flow: F,
  read: (facts: AccountingFactsReaders, event: AccountingEvent) => Promise<FactsRead<FlowFacts[F]>>,
): AccountingEventRoute {
  const policy = PROJECTION_POLICIES[flow] as ProjectionPolicy<FlowFacts[F]>;
  return {
    product,
    flow,
    async project(facts, event) {
      const read_ = await read(facts, event);
      if (read_.status === "skip") return read_;
      return { status: "ready", projection: policy(read_.facts) };
    },
  };
}

/**
 * Which events reach the books, and through which flow. Bank-transfer money that has only partly
 * arrived (`payment.bank_transfer_partially_funded`, `payment_group.bank_transfer_partially_funded`)
 * and money that could not be applied (`payment.unapplied_money_received`) are deliberately absent:
 * they make no Books document (the first is listed on the Accounting page, the second is a finance
 * task). The payment reaches the books once all of it is applied, through `payment.captured`. A new flow adds a row here (and its policy
 * in the accounting domain); nothing else changes. The event types listed must be the ones the
 * catalogue routes to the `accounting` consumer.
 */
export const ACCOUNTING_EVENT_ROUTES: Readonly<Record<string, AccountingEventRoute>> = {
  "invoice.raised": route("bid", "bid_invoice_raised", async (facts, event) => {
    const payload = invoiceRaisedPayloadSchemaV1.safeParse(event.payload);
    if (!payload.success) throw new AccountingEventPayloadError(event.eventType);
    const read = await facts.bid.invoiceRaised(payload.data.invoiceId);
    const raised = payload.data.lineIds;
    if (read.status === "ready" && raised && !sameLines(raised, read.facts.lines)) {
      // The lines are frozen when the invoice is raised: different ones are a fault, never booked.
      throw new AccountingInvoiceLinesChangedError(payload.data.invoiceId);
    }
    return read;
  }),
  "payment.captured": route("bid", "bid_payment_captured", (facts, event) => {
    const payload = paymentCapturedPayloadSchemaV1.safeParse(event.payload);
    if (!payload.success) throw new AccountingEventPayloadError(event.eventType);
    return facts.bid.paymentCaptured(payload.data.paymentId, new Date(payload.data.capturedAt));
  }),
  // "Pay several": one payment for every invoice (and courier quote) the group settled.
  "payment_group.settled": route("bid", "bid_payment_group_settled", async (facts, event) => {
    const payload = paymentGroupSettledPayloadSchemaV1.safeParse(event.payload);
    if (!payload.success) throw new AccountingEventPayloadError(event.eventType);
    const read = await facts.bid.paymentGroupSettled(payload.data.paymentGroupId);
    if (
      read.status === "ready" &&
      (!sameIds(
        payload.data.paymentIds,
        read.facts.members.map((m) => m.paymentId),
      ) ||
        !sameIds(
          payload.data.deliveryQuoteIds,
          read.facts.deliveries.map((d) => d.quoteId),
        ))
    ) {
      // Settled in one transaction with the event: different rows are a fault, never booked.
      throw new AccountingGroupRowsChangedError(payload.data.paymentGroupId);
    }
    return read;
  }),
  // Every refund that went through on the payment is replayed in order; the aggregate is the
  // payment (its own, or one lot's of a "Pay several" charge). A pending refund has no row yet, so
  // it makes nothing until it succeeds.
  "payment.refunded": route("bid", "bid_payment_refunded", async (facts, event) => {
    const read = await facts.bid.paymentRefunded(event.aggregateId);
    if (read.status === "skip" && read.reason === "refund_reversal_unmatched") {
      throw new AccountingRefundReversalUnmatchedError(event.aggregateId);
    }
    return read;
  }),
  // A courier quote's refunded total rose ("Pay several"): its delivery invoice is credited up to
  // the stored total, after the credit notes already made for it in the same books.
  "payment_group.delivery_refunded": route("bid", "bid_delivery_refunded", async (facts, event) => {
    const payload = paymentGroupDeliveryRefundedPayloadSchemaV1.safeParse(event.payload);
    if (!payload.success) throw new AccountingEventPayloadError(event.eventType);
    if (!facts.books) throw new AccountingBooksViewMissingError(event.eventType);
    // The raise is written with the event in one transaction: its time is the refund's day.
    if (!event.occurredAt) throw new AccountingEventPayloadError(event.eventType);
    const read = await facts.bid.deliveryRefunded(
      payload.data.paymentGroupId,
      payload.data.deliveryQuoteId,
      event.occurredAt,
    );
    if (read.status === "skip") return read;
    const invoice = laxReference("bid", "invoice", `dlv-${read.facts.quoteId}`);
    if (!invoice.ok) throw new AccountingEventPayloadError(event.eventType);
    const priorCredits = await facts.books.creditNotesFor(invoice.value);
    return { status: "ready", facts: { ...read.facts, priorCredits } };
  }),
  // A buyer default (only that `payment.cancelled`): the voided invoice is cancelled in the books
  // if it was never sent, or credited in full if it was issued (parked for the accountant).
  "payment.cancelled": route("bid", "bid_buyer_default", async (facts, event) => {
    const payload = paymentCancelledPayload.safeParse(event.payload);
    if (!payload.success) throw new AccountingEventPayloadError(event.eventType);
    if (payload.data.reason !== "buyer_default") {
      return { status: "skip", reason: "not_a_buyer_default" };
    }
    if (!facts.books) throw new AccountingBooksViewMissingError(event.eventType);
    const read = await facts.bid.defaultedInvoice(event.aggregateId);
    if (read.status === "skip") return read;
    const invoice = laxReference("bid", "invoice", read.facts.invoice.invoiceId);
    if (!invoice.ok) throw new AccountingEventPayloadError(event.eventType);
    const inBooks = await facts.books.invoiceStanding(invoice.value);
    const priorCredits =
      inBooks === "issued" ? await facts.books.creditNotesFor(invoice.value) : [];
    return {
      status: "ready",
      facts: {
        invoice: read.facts.invoice,
        defaultedOn: read.facts.defaultedOn,
        inBooks,
        priorCredits,
      },
    };
  }),
  // A Shop order paid: its invoice (goods, framing, delivery) and the payment, from its own rows.
  "shop.accounting.order_paid": route("shop", "shop_order_paid", async (facts, event) => {
    const payload = shopAccountingOrderPaidPayloadSchemaV1.safeParse(event.payload);
    if (!payload.success) throw new AccountingEventPayloadError(event.eventType);
    const read = await facts.shop.orderPaid(payload.data.orderId);
    if (read.status === "ready" && !sameLines(payload.data.lineIds, read.facts.lines)) {
      // The lines are frozen when the order is paid: different ones are a fault, never booked.
      throw new AccountingInvoiceLinesChangedError(payload.data.orderId);
    }
    return read;
  }),
};
