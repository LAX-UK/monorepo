import {
  type BuiltFlow,
  type FlowFacts,
  PROJECTION_POLICIES,
  type Product,
  type Projection,
  type ProjectionCode,
  type ProjectionPolicy,
  type Result,
} from "@auction/accounting-domain";
import type {
  FactsRead,
  IBidAccountingFactsReader,
  IShopAccountingFactsReader,
} from "@auction/persistence/interfaces";
import {
  invoiceRaisedPayloadSchemaV1,
  paymentCapturedPayloadSchemaV1,
  shopAccountingOrderPaidPayloadSchemaV1,
} from "@auction/types";

/** The part of a domain event the accounting projector reads. */
export interface AccountingEvent {
  readonly id: number;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly payload: unknown;
}

export type RouteOutcome =
  | { readonly status: "skip"; readonly reason: string }
  | { readonly status: "ready"; readonly projection: Result<Projection, ProjectionCode> };

/** Where each product's facts are read from (the stored rows; events carry ids only). */
export interface AccountingFactsReaders {
  readonly bid: IBidAccountingFactsReader;
  readonly shop: IShopAccountingFactsReader;
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
 * Which events reach the books, and through which flow. A new flow adds a row here (and its policy
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
  // Every refund of the payment is replayed in order; the aggregate is the payment.
  "payment.refunded": route("bid", "bid_payment_refunded", (facts, event) =>
    facts.bid.paymentRefunded(event.aggregateId),
  ),
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
