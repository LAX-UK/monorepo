import { formatCurrencyTotals } from "@/lib/format-money";
import type { PortfolioHeaderVm } from "@auction/lax-ecosystem";

export type CollectionCountVm = { key: string; label: string; value: number };

export type CollectionVm = {
  counts: CollectionCountVm[];
  /** Per-currency figures joined for display; null when nothing is owed or the total is unknown. */
  totalDue: string | null;
  paidSoFar: string | null;
};

/**
 * The Home "Your collection" figures, from the summary the Portfolio page reads. A figure of
 * zero is left out rather than shown as a lone "0" or "£0.00".
 */
export function buildCollection(header: PortfolioHeaderVm, totalWorks: number): CollectionVm {
  const counts = [
    { key: "owned", label: "Works owned", value: header.worksOwned },
    { key: "in-sale", label: "In sale or consigned", value: header.inSaleOrConsigned },
    { key: "to-pay", label: "To pay", value: header.awaitingPayment },
  ].filter((count) => count.value > 0);
  return {
    counts: counts.length > 0 ? counts : [{ key: "works", label: "Works", value: totalWorks }],
    totalDue:
      header.awaitingPayment > 0 && header.totalDue.length > 0
        ? formatCurrencyTotals(header.totalDue)
        : null,
    paidSoFar: header.paidSoFar.length > 0 ? formatCurrencyTotals(header.paidSoFar) : null,
  };
}
