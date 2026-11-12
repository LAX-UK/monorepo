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
  | "exceeds_paid_delivery"
  | "over_refunded";

function validBuckets(b: PaidBuckets): boolean {
  return [
    b.paidGoodsPence,
    b.paidDeliveryPence,
    b.refundedGoodsPence,
    b.refundedDeliveryPence,
  ].every((v) => isPence(v) && v >= 0);
}

/**
 * Pence still refundable per bucket. A bucket that has already been refunded more than it was paid
 * is a finding to investigate, not something to clamp to zero: it is refused.
 */
export function refundableOf(b: PaidBuckets): Result<RefundSplit, RefundCode> {
  if (!validBuckets(b)) return refuse("bad_amount", "amounts must be non-negative whole pence");
  if (b.refundedGoodsPence > b.paidGoodsPence || b.refundedDeliveryPence > b.paidDeliveryPence) {
    return refuse("over_refunded", "more has been refunded than was paid; review the account");
  }
  return ok({
    goodsPence: b.paidGoodsPence - b.refundedGoodsPence,
    deliveryPence: b.paidDeliveryPence - b.refundedDeliveryPence,
  });
}

/** An explicit goods/delivery refund. Either bucket exceeding what was paid (net of earlier refunds) is refused. */
export function planRefund(
  buckets: PaidBuckets,
  request: RefundSplit,
): Result<RefundSplit, RefundCode> {
  if (!isPence(request.goodsPence) || !isPence(request.deliveryPence)) {
    return refuse("bad_amount", "amounts must be whole pence");
  }
  if (request.goodsPence < 0 || request.deliveryPence < 0) {
    return refuse("bad_amount", "refund amounts cannot be negative");
  }
  if (request.goodsPence + request.deliveryPence === 0) {
    return refuse("bad_amount", "a refund must be more than zero");
  }
  const left = refundableOf(buckets);
  if (!left.ok) return left;
  if (request.goodsPence > left.value.goodsPence) {
    return refuse("exceeds_paid_goods", "goods refund exceeds what was paid for goods");
  }
  if (request.deliveryPence > left.value.deliveryPence) {
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
  if (!isPence(totalPence) || totalPence <= 0) {
    return refuse("bad_amount", "a refund must be positive whole pence");
  }
  const left = refundableOf(buckets);
  if (!left.ok) return left;
  if (totalPence > left.value.goodsPence + left.value.deliveryPence) {
    return refuse("exceeds_paid", "refund exceeds what was paid");
  }
  const goodsPence = Math.min(totalPence, left.value.goodsPence);
  return ok({ goodsPence, deliveryPence: totalPence - goodsPence });
}
