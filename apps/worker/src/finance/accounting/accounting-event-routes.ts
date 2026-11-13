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
import type { FactsRead, IBidAccountingFactsReader } from "@auction/persistence/interfaces";
import { invoiceRaisedPayloadSchemaV1, paymentCapturedPayloadSchemaV1 } from "@auction/types";

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

/** One event type's way into the books: which product, which flow, and how its facts are read. */
export interface AccountingEventRoute {
  readonly product: Product;
  readonly flow: BuiltFlow;
  project(facts: IBidAccountingFactsReader, event: AccountingEvent): Promise<RouteOutcome>;
}

/** Thrown when an event cannot be read as its contract says; the delivery is not retried. */
export class AccountingEventPayloadError extends Error {
  constructor(eventType: string) {
    super(`accounting_event_payload_invalid:${eventType}`);
    this.name = "AccountingEventPayloadError";
  }
}

function route<F extends BuiltFlow>(
  product: Product,
  flow: F,
  read: (
    facts: IBidAccountingFactsReader,
    event: AccountingEvent,
  ) => Promise<FactsRead<FlowFacts[F]>>,
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
  "invoice.raised": route("bid", "bid_invoice_raised", (facts, event) => {
    const payload = invoiceRaisedPayloadSchemaV1.safeParse(event.payload);
    if (!payload.success) throw new AccountingEventPayloadError(event.eventType);
    return facts.invoiceRaised(payload.data.invoiceId);
  }),
  "payment.captured": route("bid", "bid_payment_captured", (facts, event) => {
    const payload = paymentCapturedPayloadSchemaV1.safeParse(event.payload);
    if (!payload.success) throw new AccountingEventPayloadError(event.eventType);
    return facts.paymentCaptured(payload.data.paymentId, new Date(payload.data.capturedAt));
  }),
  // Every refund of the payment is replayed in order; the aggregate is the payment.
  "payment.refunded": route("bid", "bid_payment_refunded", (facts, event) =>
    facts.paymentRefunded(event.aggregateId),
  ),
};
