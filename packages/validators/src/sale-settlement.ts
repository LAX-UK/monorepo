/** Admin list filter for ended-sale settlement (buyer payment captured or refunded). */
export const saleSettlementStatuses = ["settled", "unsettled"] as const;

export type SaleSettlementStatus = (typeof saleSettlementStatuses)[number];

export type SaleSettlementLot = {
  id: string;
  status: string;
  winnerId: string | null;
};

/** True when every sold lot has a captured or refunded payment (or there are no sold lots). */
export function isSaleSettled(
  lots: readonly SaleSettlementLot[],
  paymentStatusByLotId: ReadonlyMap<string, string>,
): boolean {
  const soldLots = lots.filter((lot) => lot.status === "ended" && lot.winnerId);
  if (soldLots.length === 0) return true;
  return soldLots.every((lot) => {
    const status = paymentStatusByLotId.get(lot.id);
    return status === "captured" || status === "refunded";
  });
}
