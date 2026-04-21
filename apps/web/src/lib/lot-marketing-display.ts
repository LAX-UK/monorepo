import { formatMoney } from "@/lib/format-currency";
import type { Lot } from "@auction/types";

/** One-line pre-sale estimate for cards and rails; returns null when absent. */
export function lotEstimateLine(auction: Lot): string | null {
  const est = auction.marketingDetails?.estimate;
  if (!est?.low || !est?.high) return null;
  try {
    return `${formatMoney(est.low)} – ${formatMoney(est.high)} ${est.currency}`;
  } catch {
    return null;
  }
}
