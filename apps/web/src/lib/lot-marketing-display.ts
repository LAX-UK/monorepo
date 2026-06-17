import { formatEstimateRange } from "@/lib/format-currency";
import type { CatalogLotVM } from "@auction/types";

/** One-line pre-sale estimate for cards and rails; returns null when absent. */
export function lotEstimateLine(auction: Pick<CatalogLotVM, "marketingDetails">): string | null {
  const est = auction.marketingDetails?.estimate;
  if (!est?.low || !est?.high) return null;
  try {
    return formatEstimateRange(est);
  } catch {
    return null;
  }
}
