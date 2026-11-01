import { formatMoney } from "@/lib/format-currency";
import { lotCatalogHref } from "@/lib/marketing/catalog-links";
import type { SaleResultsSummary } from "@auction/domain";
import type { Lot } from "@auction/types";

export type ResultsStat = {
  label: string;
  value: string;
  /** The lot behind the figure, when it can be linked. */
  detail?: { text: string; href: string };
};

/** What the results band at the top of an ended sale shows. */
export type ResultsBandVM =
  | { state: "finalising"; title: string; detail: string }
  | { state: "final"; heading: string; stats: ResultsStat[]; footnote: string };

type TopLotSource = Pick<Lot, "id" | "title" | "lotNumber">;

const FINALISING_TITLE = "Results are being finalised";
const FINALISING_DETAIL = "Final prices appear here within a day of the close.";

function topLotDetail(lot: TopLotSource | undefined): ResultsStat["detail"] | undefined {
  if (!lot) return undefined;
  const number = lot.lotNumber != null ? `Lot ${lot.lotNumber}` : null;
  return {
    text: [number, lot.title].filter(Boolean).join(" · "),
    href: lotCatalogHref(lot),
  };
}

/**
 * The results of an ended sale as the server computed them. A sale still closing its lots or
 * waiting for an external result carries no figures, and none are made up here: a partial catalogue
 * never produces a total. With nothing sold only the count is shown, never a lone zero total.
 */
export function buildResultsBand(
  summary: SaleResultsSummary | null,
  lots: readonly TopLotSource[],
): ResultsBandVM | null {
  if (!summary) return null;
  if (summary.state === "finalising") {
    return { state: "finalising", title: FINALISING_TITLE, detail: FINALISING_DETAIL };
  }

  const stats: ResultsStat[] = [
    { label: "Lots sold", value: `${summary.soldCount} of ${summary.lotCount}` },
  ];
  if (summary.soldCount > 0) {
    stats.push({
      label: "Total with buyer’s premium",
      value: formatMoney(summary.totalWithPremium, summary.currency),
    });
    if (summary.topLot) {
      const topLot = lots.find((lot) => lot.id === summary.topLot?.lotId);
      const detail = topLotDetail(topLot);
      stats.push({
        label: "Top lot",
        value: formatMoney(summary.topLot.priceWithPremium, summary.currency),
        ...(detail ? { detail } : {}),
      });
    }
  }
  return {
    state: "final",
    heading: "Sale results",
    stats,
    footnote: "Prices include buyer’s premium.",
  };
}
