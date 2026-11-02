export type RefundLineInput = {
  amountPence: number;
  status: "pending" | "succeeded" | "failed" | "cancelled";
  orderLineId: string | null;
  /** Where the refund came from; a `cancellation` marks its line as returned to LAX. */
  source?: "admin" | "cancellation" | "stripe_dashboard";
};

export type OrderLineAmount = {
  orderLineId: string;
  totalPence: number;
};

/**
 * Lines cancelled after possession: those with a cancellation refund that is still owed or paid.
 * A failed cancellation refund counts, because the customer is still owed that money and staff
 * retry it rather than refunding the item again some other way.
 */
export function cancelledLineIds(refunds: readonly RefundLineInput[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const refund of refunds) {
    if (refund.source === "cancellation" && refund.status !== "cancelled" && refund.orderLineId) {
      ids.add(refund.orderLineId);
    }
  }
  return ids;
}

export function sumRefundedOrPendingPence(
  refunds: readonly RefundLineInput[],
  orderLineId?: string,
): number {
  return refunds
    .filter((row) => row.status === "pending" || row.status === "succeeded")
    .filter((row) => (orderLineId ? row.orderLineId === orderLineId : true))
    .reduce((sum, row) => sum + row.amountPence, 0);
}

/**
 * What may still be refunded.
 *
 * - With an `orderLineId`: the line's own remainder, never more than is left on the order. A line
 *   cancelled after possession has nothing left to refund: its cancellation refund is the refund.
 * - Without one (a whole-order refund) and with `orderLines`: the order's total less every
 *   cancelled line's price, less the refunds that are not for a cancelled line. A whole-order
 *   refund therefore never touches money that a cancellation refund already covers, whether that
 *   refund is pending, paid or waiting for a retry.
 * - Without `orderLines`: the order's total less everything refunded or pending.
 */
export function remainingRefundablePence(input: {
  orderTotalPence: number;
  lineTotalPence?: number;
  refunds: readonly RefundLineInput[];
  orderLineId?: string;
  orderLines?: readonly OrderLineAmount[];
}): number {
  const orderRemaining = input.orderTotalPence - sumRefundedOrPendingPence(input.refunds);
  if (input.lineTotalPence === undefined) {
    if (!input.orderLines) return Math.max(0, orderRemaining);
    const cancelled = cancelledLineIds(input.refunds);
    if (cancelled.size === 0) return Math.max(0, orderRemaining);
    const cancelledTotal = input.orderLines
      .filter((line) => cancelled.has(line.orderLineId))
      .reduce((sum, line) => sum + line.totalPence, 0);
    const otherRefunds = input.refunds.filter(
      (refund) => !refund.orderLineId || !cancelled.has(refund.orderLineId),
    );
    return Math.max(
      0,
      input.orderTotalPence - cancelledTotal - sumRefundedOrPendingPence(otherRefunds),
    );
  }
  if (input.orderLineId && cancelledLineIds(input.refunds).has(input.orderLineId)) return 0;
  // A line can never take back more than is left on the whole order: whole-order refunds
  // (no line) already reduce what any single line may still refund.
  const lineRemaining =
    input.lineTotalPence - sumRefundedOrPendingPence(input.refunds, input.orderLineId);
  return Math.max(0, Math.min(lineRemaining, orderRemaining));
}
