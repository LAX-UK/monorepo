import { type Pence, isPence } from "./money.js";
import { type Result, ok, refuse } from "./result.js";

/** What has been paid and already refunded, split between goods and delivery. */
export interface PaidBuckets {
  readonly paidGoodsPence: Pence;
  readonly paidDeliveryPence: Pence;
  readonly refundedGoodsPence: Pence;
  readonly refundedDeliveryPence: Pence;
}

export interface RefundSplit {
  readonly goodsPence: Pence;
  readonly deliveryPence: Pence;
}

export type RefundCode =
  | "bad_amount"
  | "exceeds_paid"
  | "exceeds_paid_goods"
  | "exceeds_paid_delivery";

function refundable(paid: Pence, refunded: Pence): Pence {
  return Math.max(0, paid - refunded);
}

function validBuckets(b: PaidBuckets): boolean {
  return [
    b.paidGoodsPence,
    b.paidDeliveryPence,
    b.refundedGoodsPence,
    b.refundedDeliveryPence,
  ].every((v) => isPence(v) && v >= 0);
}

/** Pence still refundable per bucket. */
export function refundableOf(b: PaidBuckets): RefundSplit {
  return {
    goodsPence: refundable(b.paidGoodsPence, b.refundedGoodsPence),
    deliveryPence: refundable(b.paidDeliveryPence, b.refundedDeliveryPence),
  };
}

/** An explicit goods/delivery refund. Either bucket exceeding what was paid (net of earlier refunds) is refused. */
export function planRefund(
  buckets: PaidBuckets,
  request: RefundSplit,
): Result<RefundSplit, RefundCode> {
  if (!validBuckets(buckets) || !isPence(request.goodsPence) || !isPence(request.deliveryPence)) {
    return refuse("bad_amount", "amounts must be whole pence");
  }
  if (request.goodsPence < 0 || request.deliveryPence < 0) {
    return refuse("bad_amount", "refund amounts cannot be negative");
  }
  const left = refundableOf(buckets);
  if (request.goodsPence > left.goodsPence) {
    return refuse("exceeds_paid_goods", "goods refund exceeds what was paid for goods");
  }
  if (request.deliveryPence > left.deliveryPence) {
    return refuse("exceeds_paid_delivery", "delivery refund exceeds what was paid for delivery");
  }
  return ok({ goodsPence: request.goodsPence, deliveryPence: request.deliveryPence });
}

/**
 * A single refund amount with no stated split: goods are refunded first, delivery takes the rest.
 * The total can never exceed what is still refundable across both buckets.
 */
export function splitRefundTotal(
  buckets: PaidBuckets,
  totalPence: Pence,
): Result<RefundSplit, RefundCode> {
  if (!validBuckets(buckets) || !isPence(totalPence) || totalPence < 0) {
    return refuse("bad_amount", "amounts must be non-negative whole pence");
  }
  const left = refundableOf(buckets);
  if (totalPence > left.goodsPence + left.deliveryPence) {
    return refuse("exceeds_paid", "refund exceeds what was paid");
  }
  const goodsPence = Math.min(totalPence, left.goodsPence);
  return ok({ goodsPence, deliveryPence: totalPence - goodsPence });
}
