import { atgDisplaySale } from "@/lib/catalog/atg-catalog-display";
import { formatLondonDayMonth, formatLondonWeekday, toDate } from "@/lib/datetime/london-time";
import { formatWholeMoney } from "@/lib/money/currency";
import type { SaleListRow } from "@/lib/sale-list-row";
import { salePath } from "@/lib/seo/url";
import type { Lot, Sale, SaleDeliveryMode } from "@auction/types";

/** The order the Sales view is in, said out loud. */
export const RESULTS_SORT_LABEL = "Newest first";

const MAX_COVERS = 2;

const DELIVERY_LABEL: Record<SaleDeliveryMode, string> = {
  online: "online",
  hybrid: "online and in the room",
  onsite: "in the room",
};

export type ResultsCover = { url: string; alt: string };

export type ResultsFigures =
  | { state: "finalising" }
  | {
      state: "final";
      /** "18 of 24". */
      sold: string;
      /** "£186,400"; null when nothing sold, so no bare zero is shown. */
      total: string | null;
    };

export type ResultsRowVM = {
  id: string;
  href: string;
  title: string;
  covers: ResultsCover[];
  /** "Ended Thu 15 Oct · online". */
  endedLabel: string;
  figures: ResultsFigures;
  actionLabel: "See results" | "View the sale";
  /** ISO instant the sale closed; the list is ordered by it. */
  endedAtIso: string;
};

function endedAt(row: SaleListRow): Date | null {
  const summary = row.resultsSummary;
  const fromSummary = summary?.state === "final" ? toDate(summary.endedAt) : null;
  return fromSummary ?? toDate(row.sale.endTime);
}

function endedLabel(sale: Sale, ended: Date | null, now: Date): string {
  const mode = DELIVERY_LABEL[sale.deliveryMode] ?? "";
  if (!ended) return mode ? `Ended · ${mode}` : "Ended";
  const when = `${formatLondonWeekday(ended)} ${formatLondonDayMonth(ended, now)}`;
  return mode ? `Ended ${when} · ${mode}` : `Ended ${when}`;
}

function isSold(lot: Lot): boolean {
  return lot.status === "ended" && lot.winnerId != null;
}

/** Up to two works for the cover: the top lot first, then other sold works, then any with an image. */
export function pickResultsCovers(row: SaleListRow): ResultsCover[] {
  const topLotId = row.resultsSummary?.state === "final" ? row.resultsSummary.topLot?.lotId : null;
  const withImage = row.lots.filter((lot) => lot.images[0]);
  const rank = (lot: Lot) => (lot.id === topLotId ? 0 : isSold(lot) ? 1 : 2);
  return [...withImage]
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, MAX_COVERS)
    .map((lot) => ({ url: lot.images[0] as string, alt: lot.title }));
}

function figuresFor(row: SaleListRow): ResultsFigures | null {
  const summary = row.resultsSummary;
  if (!summary) return null;
  if (summary.state === "finalising") return { state: "finalising" };
  const total = summary.soldCount > 0 ? summary.totalWithPremium : null;
  return {
    state: "final",
    sold: `${summary.soldCount} of ${summary.lotCount}`,
    total: total ? formatWholeMoney(total, summary.currency) : null,
  };
}

/**
 * One row per ended sale that has lots and a results summary, newest close first.
 * A sale with no lots has nothing to show, so it is left out.
 */
export function buildResultsRows(rows: readonly SaleListRow[], now = new Date()): ResultsRowVM[] {
  const built: ResultsRowVM[] = [];
  for (const row of rows) {
    const figures = figuresFor(row);
    if (!figures || row.lotCount === 0) continue;
    const sale = atgDisplaySale(row.sale);
    const ended = endedAt(row);
    built.push({
      id: sale.id,
      href: salePath(sale),
      title: sale.title,
      covers: pickResultsCovers(row),
      endedLabel: endedLabel(sale, ended, now),
      figures,
      actionLabel: figures.state === "finalising" ? "View the sale" : "See results",
      endedAtIso: ended?.toISOString() ?? "",
    });
  }
  return built.sort((a, b) => b.endedAtIso.localeCompare(a.endedAtIso));
}

/** Years in which at least one sale with results closed, newest first. */
export function resultsYears(rows: readonly SaleListRow[]): number[] {
  const years = new Set<number>();
  for (const row of rows) {
    if (!row.resultsSummary || row.lotCount === 0) continue;
    const ended = endedAt(row);
    if (ended)
      years.add(
        Number(ended.toLocaleString("en-GB", { year: "numeric", timeZone: "Europe/London" })),
      );
  }
  return [...years].sort((a, b) => b - a);
}
