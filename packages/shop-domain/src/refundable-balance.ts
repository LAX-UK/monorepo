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
  const cap = input.lineTotalPence ?? input.orderTotalPence;
  const used = sumRefundedOrPendingPence(input.refunds, input.orderLineId);
  return Math.max(0, cap - used);
}
