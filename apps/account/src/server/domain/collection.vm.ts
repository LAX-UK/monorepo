import { formatCurrencyTotals } from "@/lib/format-money";
import type { PortfolioHeaderVm } from "@auction/lax-ecosystem";

export type CollectionCountVm = {
  key: string;
  label: string;
  /** The shorter label shown on a phone, where the long one would wrap. */
  shortLabel: string;
  value: number;
};

export type CollectionVm = {
  counts: CollectionCountVm[];
  /** Per-currency figures joined for display; null when nothing is owed or the total is unknown. */
  totalDue: string | null;
  /** "Includes 1 waiting on identity checks.", or null when none is held. */
  totalDueNote: string | null;
  paidSoFar: string | null;
  paidSoFarNote: string;
};

export const PAID_SO_FAR_NOTE =
  "What you've paid across LAX, in the currency you paid. Not a valuation.";

function totalDueNote(inReview: number): string | null {
  return inReview > 0 ? `Includes ${inReview} waiting on identity checks.` : null;
}

/**
 * The "Your collection" figures, on Home and at the top of Portfolio,, from the summary the Portfolio page reads. A figure of
 * zero is left out rather than shown as a lone "0" or "£0.00".
 */
export function buildCollection(header: PortfolioHeaderVm, totalWorks: number): CollectionVm {
  const counts = [
    { key: "owned", label: "Works owned", shortLabel: "Owned", value: header.worksOwned },
    {
      key: "in-sale",
      label: "In sale or consigned",
      shortLabel: "In sale",
      value: header.inSaleOrConsigned,
    },
    { key: "to-pay", label: "To pay", shortLabel: "To pay", value: header.awaitingPayment },
  ].filter((count) => count.value > 0);
  return {
    counts:
      counts.length > 0
        ? counts
        : [{ key: "works", label: "Works", shortLabel: "Works", value: totalWorks }],
    totalDue:
      header.awaitingPayment > 0 && header.totalDue.length > 0
        ? formatCurrencyTotals(header.totalDue)
        : null,
    totalDueNote: header.awaitingPayment > 0 ? totalDueNote(header.inReview) : null,
    paidSoFar: header.paidSoFar.length > 0 ? formatCurrencyTotals(header.paidSoFar) : null,
    paidSoFarNote: PAID_SO_FAR_NOTE,
  };
}
