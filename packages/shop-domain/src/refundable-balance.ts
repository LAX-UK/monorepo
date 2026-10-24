export type RefundLineInput = {
  amountPence: number;
  status: "pending" | "succeeded" | "failed" | "cancelled";
  orderLineId: string | null;
};

export function sumRefundedOrPendingPence(
  refunds: readonly RefundLineInput[],
  orderLineId?: string,
): number {
  return refunds
    .filter((row) => row.status === "pending" || row.status === "succeeded")
    .filter((row) => (orderLineId ? row.orderLineId === orderLineId : true))
    .reduce((sum, row) => sum + row.amountPence, 0);
}

export function remainingRefundablePence(input: {
  orderTotalPence: number;
  lineTotalPence?: number;
  refunds: readonly RefundLineInput[];
  orderLineId?: string;
}): number {
  const orderRemaining = input.orderTotalPence - sumRefundedOrPendingPence(input.refunds);
  if (input.lineTotalPence === undefined) return Math.max(0, orderRemaining);
  // A line can never take back more than is left on the whole order: whole-order refunds
  // (no line) already reduce what any single line may still refund.
  const lineRemaining =
    input.lineTotalPence - sumRefundedOrPendingPence(input.refunds, input.orderLineId);
  return Math.max(0, Math.min(lineRemaining, orderRemaining));
}
