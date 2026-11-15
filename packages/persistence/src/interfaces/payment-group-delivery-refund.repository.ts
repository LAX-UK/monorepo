import type { Database } from "@auction/db";

/** Where a staff courier refund request stands. */
export type DeliveryRefundRequestStatus = "pending" | "succeeded" | "failed";

/**
 * One staff refund of a quote's courier charge in a combined payment. A `pending` or `succeeded`
 * request holds its amount against what is left of the charge; a `failed` one holds nothing.
 */
export type DeliveryRefundRequest = {
  id: string;
  paymentGroupId: string;
  deliveryQuoteId: string;
  amountPence: number;
  status: DeliveryRefundRequestStatus;
  staffReason: string;
  actorUserId: string;
  stripeRefundId: string | null;
  stripeStatus: string | null;
  createdAt: Date;
};

export type NewDeliveryRefundRequest = {
  paymentGroupId: string;
  deliveryQuoteId: string;
  amountPence: number;
  staffReason: string;
  actorUserId: string;
};

/** What Stripe said about a request's refund. */
export type DeliveryRefundRequestOutcome = {
  status: DeliveryRefundRequestStatus;
  stripeRefundId: string | null;
  stripeStatus: string | null;
};

/**
 * Staff courier refund requests (migration 0393). The caller holds the payment group's lock
 * (`IPaymentGroupRepository.lockInTransaction`) while it reads the requests and writes a new one,
 * so what is left of a courier charge is worked out and reserved in one step.
 */
export interface IPaymentGroupDeliveryRefundRepository {
  /** Every request for the quote in the group, oldest first, inside `tx`. */
  listForQuoteInTransaction(
    tx: Database,
    paymentGroupId: string,
    deliveryQuoteId: string,
  ): Promise<DeliveryRefundRequest[]>;
  /** Records a new `pending` request, inside `tx`. */
  insertInTransaction(
    tx: Database,
    input: NewDeliveryRefundRequest,
  ): Promise<DeliveryRefundRequest>;
  /** Records Stripe's answer for the request. `false` when no such request exists. */
  recordOutcome(
    conn: Database,
    id: string,
    outcome: DeliveryRefundRequestOutcome,
  ): Promise<boolean>;
  /**
   * Frees a request that never reached Stripe (`pending`, no Stripe refund): marks it `failed`.
   * Does nothing to a request that has a Stripe refund or is no longer pending.
   */
  releaseUnsentInTransaction(tx: Database, id: string): Promise<boolean>;
}
