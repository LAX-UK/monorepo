import {
  type BuiltFlow,
  type CreditNote,
  type CreditStanding,
  type DefaultedInvoiceInBooks,
  type FlowFacts,
  PROJECTION_POLICIES,
  type Product,
  type Projection,
  type ProjectionCode,
  type ProjectionPolicy,
  type Result,
  laxReference,
  shopCreditBuiltAfter,
} from "@auction/accounting-domain";
import type {
  CreditBasis,
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
  shopRefundCompletedPayloadSchemaV1,
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
  | {
      readonly status: "ready";
      readonly projection: Result<Projection, ProjectionCode>;
      /** What its credit notes were built from, checked again when each is registered. */
      readonly basis?: CreditBasis;
    };

/** Facts read for a flow, with what its credit notes are built from when that is checked. */
type RouteRead<F> =
  | FactsRead<F>
  | { readonly status: "ready"; readonly facts: F; readonly basis?: CreditBasis };

/**
 * What the books the switch aims at now already hold for a product (its current target): the
 * credit notes registered for an invoice, and where an invoice stands. A new credit note is built
 * after the ones already there, and a buyer default cancels or credits by the invoice's standing.
 */
export interface BooksView {
  creditNotesFor(invoiceReference: string): Promise<readonly CreditNote[]>;
  invoiceStanding(invoiceReference: string): Promise<DefaultedInvoiceInBooks>;
  /** Where a credit note stands there (read the same way as an invoice's standing). */
  creditStanding(creditNoteReference: string): Promise<CreditStanding>;
  /**
   * Waits for every credit note of the invoice being registered there right now. A reversal reads
   * the credit notes after it, so none registered from facts read before the reversal is missed.
   */
  awaitCreditRegistrations(invoiceReference: string): Promise<void>;
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
  read: (facts: AccountingFactsReaders, event: AccountingEvent) => Promise<RouteRead<FlowFacts[F]>>,
  basisOf?: (facts: FlowFacts[F], projection: Projection) => CreditBasis,
): AccountingEventRoute {
  const policy = PROJECTION_POLICIES[flow] as ProjectionPolicy<FlowFacts[F]>;
  return {
    product,
    flow,
    async project(facts, event) {
      const read_ = await read(facts, event);
      if (read_.status === "skip") return read_;
      const projection = policy(read_.facts);
      // A basis that depends on what was built (each new credit note's place) is stated after it.
      const basis =
        basisOf && projection.ok
          ? basisOf(read_.facts, projection.value)
          : "basis" in read_
            ? read_.basis
            : undefined;
      return { status: "ready", projection, ...(basis ? { basis } : {}) };
    },
  };
}

/** The credit notes' total gross. */
const creditOf = (notes: readonly CreditNote[]) =>
  notes.reduce((sum, note) => sum + note.totals.grossPence, 0);

/** `payment_group.refund_reversed` as the books read it: which courier quote, if any. */
const groupRefundReversedPayload = z
  .object({ paymentGroupId: z.string().min(1), deliveryQuoteId: z.string().min(1).nullable() })
  .passthrough();

/**
 * A courier quote's refunded total and the credit notes already made for its delivery invoice in
 * the books the switch aims at now, each with where it stands, and the basis the next credit note
 * is checked against when registered (the total and the credit as read). After a lowering the
 * credit notes are read only once no registration is under way (`awaitCreditRegistrations`).
 */
async function readDeliveryRefund(
  facts: AccountingFactsReaders,
  event: AccountingEvent,
  groupId: string,
  quoteId: string,
  lowered: boolean,
): Promise<RouteRead<FlowFacts["bid_delivery_refunded"]>> {
  if (!facts.books) throw new AccountingBooksViewMissingError(event.eventType);
  // The change is written with the event in one transaction: its time is the refund's day.
  if (!event.occurredAt) throw new AccountingEventPayloadError(event.eventType);
  const invoice = laxReference("bid", "invoice", `dlv-${quoteId.toLowerCase()}`);
  if (!invoice.ok) throw new AccountingEventPayloadError(event.eventType);
  if (lowered) await facts.books.awaitCreditRegistrations(invoice.value);
  const read = await facts.bid.deliveryRefunded(groupId, quoteId, event.occurredAt);
  if (read.status === "skip") return read;
  const priorCredits = await facts.books.creditNotesFor(invoice.value);
  const priorStandings: CreditStanding[] = [];
  for (const note of priorCredits) {
    priorStandings.push(await facts.books.creditStanding(note.reference));
  }
  return {
    status: "ready",
    facts: { ...read.facts, priorCredits, priorStandings },
    basis: {
      kind: "delivery_refund",
      groupId,
      quoteId,
      refundedPence: read.facts.refundedPence,
      priorCreditPence: creditOf(priorCredits),
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
  // A refund's credit note already registered is kept as stored (a replay); the basis is the
  // payment's refund rows as read, so a refund taken back meanwhile refuses the registration and
  // the event is read again.
  "payment.refunded": route("bid", "bid_payment_refunded", async (facts, event) => {
    const read = await facts.bid.paymentRefunded(event.aggregateId);
    if (read.status === "skip" && read.reason === "refund_reversal_unmatched") {
      throw new AccountingRefundReversalUnmatchedError(event.aggregateId);
    }
    if (read.status === "skip") return read;
    const { refundRows, ...refunds } = read.facts;
    const invoice = laxReference("bid", "invoice", refunds.invoice.invoiceId);
    if (!invoice.ok) throw new AccountingEventPayloadError(event.eventType);
    const registered = facts.books ? await facts.books.creditNotesFor(invoice.value) : undefined;
    return {
      status: "ready",
      facts: { ...refunds, ...(registered ? { registered } : {}) },
      ...(refundRows === undefined
        ? {}
        : {
            basis: {
              kind: "payment_refunds" as const,
              paymentId: event.aggregateId,
              refundRows,
            },
          }),
    };
  }),
  // A refund taken back (it failed after it was counted) on a payment: the credit note made for it
  // is cancelled if it was never sent, or held for a person if it was issued (never guessed).
  "payment.refund_reversed": route("bid", "bid_payment_refund_reversed", async (facts, event) => {
    if (!facts.books || !facts.bid.paymentRefundReversals) {
      throw new AccountingBooksViewMissingError(event.eventType);
    }
    const head = await facts.bid.paymentRefundReversals(event.aggregateId);
    if (head.status === "skip" && head.reason === "refund_reversal_unmatched") {
      throw new AccountingRefundReversalUnmatchedError(event.aggregateId);
    }
    if (head.status === "skip") return head;
    const invoice = laxReference("bid", "invoice", head.facts.invoiceId);
    if (!invoice.ok) throw new AccountingEventPayloadError(event.eventType);
    // Any registration that read its facts before the reversal has committed, or will be refused.
    await facts.books.awaitCreditRegistrations(invoice.value);
    const read = await facts.bid.paymentRefundReversals(event.aggregateId);
    if (read.status === "skip") return read;
    const reversed: { reference: string; standing: CreditStanding }[] = [];
    for (const refundId of read.facts.reversedRefundIds) {
      const reference = laxReference("bid", "credit_note", refundId);
      if (!reference.ok) throw new AccountingEventPayloadError(event.eventType);
      reversed.push({
        reference: reference.value,
        standing: await facts.books.creditStanding(reference.value),
      });
    }
    return { status: "ready", facts: { reversed } };
  }),
  // A courier quote's refunded total rose ("Pay several"): its delivery invoice is credited up to
  // the stored total, after the credit notes already made for it in the same books.
  "payment_group.delivery_refunded": route("bid", "bid_delivery_refunded", async (facts, event) => {
    const payload = paymentGroupDeliveryRefundedPayloadSchemaV1.safeParse(event.payload);
    if (!payload.success) throw new AccountingEventPayloadError(event.eventType);
    return readDeliveryRefund(
      facts,
      event,
      payload.data.paymentGroupId,
      payload.data.deliveryQuoteId,
      false,
    );
  }),
  // A courier quote's refunded total lowered (a refund taken back by the group's refund repair):
  // its credit notes above the new total are cancelled if never sent, or held for a person if
  // issued; if cancelling left the credit below the total, the rest is credited again. A reversal
  // of the group's unassigned refunds names no quote and makes nothing.
  "payment_group.refund_reversed": route("bid", "bid_delivery_refunded", async (facts, event) => {
    const payload = groupRefundReversedPayload.safeParse(event.payload);
    if (!payload.success) throw new AccountingEventPayloadError(event.eventType);
    if (payload.data.deliveryQuoteId === null) {
      return { status: "skip", reason: "not_a_delivery_refund" };
    }
    return readDeliveryRefund(
      facts,
      event,
      payload.data.paymentGroupId,
      payload.data.deliveryQuoteId,
      true,
    );
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
      basis: { kind: "invoice_credit", priorCreditPence: creditOf(priorCredits) },
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
  // A Shop refund went through (Stripe, or settled outside it by staff): every refund of the order
  // that went through is replayed against the order's invoice, after its credit notes already
  // registered; each new one is checked when registered against the refunds and credit it was
  // built after.
  "shop.refund.completed": route(
    "shop",
    "shop_refund_settled",
    async (facts, event) => {
      const payload = shopRefundCompletedPayloadSchemaV1.safeParse(event.payload);
      if (!payload.success) throw new AccountingEventPayloadError(event.eventType);
      if (payload.data.status !== "succeeded") return { status: "skip", reason: "not_succeeded" };
      if (!facts.shop.refundSettled) return { status: "skip", reason: "shop_facts_not_wired" };
      if (!facts.books) throw new AccountingBooksViewMissingError(event.eventType);
      const read = await facts.shop.refundSettled(payload.data.refundId);
      if (read.status === "skip") return read;
      const invoice = laxReference("shop", "invoice", read.facts.order.orderId);
      if (!invoice.ok) throw new AccountingEventPayloadError(event.eventType);
      const registered = await facts.books.creditNotesFor(invoice.value);
      return { status: "ready", facts: { ...read.facts, registered } };
    },
    (facts, projection) => ({
      kind: "shop_refunds",
      orderId: facts.order.orderId,
      succeededRefunds: facts.refunds.length,
      builtAfter: shopCreditBuiltAfter(projection.documents, facts.registered),
    }),
  ),
};
