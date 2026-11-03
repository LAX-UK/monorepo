import { formatWholeMoney } from "@/lib/format-currency";
import type { CatalogLotVM } from "@auction/types";

/** One-line pre-sale estimate for cards and rails, in whole pounds ("£4,000 – £6,000"); null when absent. */
export function lotEstimateLine(auction: Pick<CatalogLotVM, "marketingDetails">): string | null {
  const est = auction.marketingDetails?.estimate;
  if (!est?.low || !est?.high) return null;
  try {
    const low = formatWholeMoney(est.low, est.currency);
    const high = formatWholeMoney(est.high, est.currency);
    return low === "—" || high === "—" ? null : `${low} – ${high}`;
  } catch {
    return null;
  }
}
