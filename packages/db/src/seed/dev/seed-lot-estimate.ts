/** Every demo sale is held in pounds sterling, so every demo lot's estimate is too. */
export const SEED_SALE_CURRENCY = "GBP";

export function seedLotEstimate(low: string, high: string) {
  return { low, high, currency: SEED_SALE_CURRENCY };
}
