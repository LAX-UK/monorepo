export type ShopStockReconciliationResult = {
  comparedEditionCount: number;
  mismatchCount: number;
};

/** Phase 3 skeleton: compares shop edition ownership to Zoho projections (not wired to cron yet). */
export async function runShopStockReconciliationJob(): Promise<ShopStockReconciliationResult> {
  return { comparedEditionCount: 0, mismatchCount: 0 };
}
