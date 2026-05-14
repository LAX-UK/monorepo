import type { PortfolioLotCardVm } from "@/components/dashboard/portfolio-lot-grid";
import { formatMoney } from "@/lib/format-currency";
import { portfolioSettlementLabel } from "@/lib/portfolio-settlement";
import type { PortfolioRow } from "@auction/types";
import { lotTotalMajorUnits } from "./lot-pricing-helpers";

export function filterPortfolioRowsByTitle(rows: PortfolioRow[], qLower: string): PortfolioRow[] {
  if (qLower.length === 0) return rows;
  return rows.filter((row) => row.lot.title.toLowerCase().includes(qLower));
}

export type PortfolioPaymentFilter = "all" | "due" | "paid" | "authorized" | "refunded";

/** Apply payment-state and year filters in addition to title search. */
export function filterPortfolioRows(
  rows: PortfolioRow[],
  filters: {
    qLower: string;
    payment: PortfolioPaymentFilter;
    year: number | null;
  },
): PortfolioRow[] {
  const titled = filterPortfolioRowsByTitle(rows, filters.qLower);
  return titled.filter((row) => {
    if (filters.year != null && row.lot.endTime.getUTCFullYear() !== filters.year) {
      return false;
    }
    if (filters.payment === "all") return true;
    const status = row.payment?.status ?? null;
    if (filters.payment === "due") {
      return status !== "captured" && status !== "refunded";
    }
    if (filters.payment === "paid") return status === "captured";
    if (filters.payment === "authorized") return status === "authorized";
    if (filters.payment === "refunded") return status === "refunded";
    return true;
  });
}

export type PortfolioAnalyticsVm = {
  totalRows: number;
  totalSpentFormatted: string;
  outstandingFormatted: string;
  wonThisYear: number;
  /** Sorted years available in the portfolio. Used for the year filter. */
  years: number[];
  /** Map of category id -> count (for high-level summary). */
  categoryCounts: { id: string; count: number }[];
};

export function buildPortfolioAnalytics(
  rows: readonly PortfolioRow[],
  options?: { now?: Date },
): PortfolioAnalyticsVm {
  let totalSpent = 0;
  let outstanding = 0;
  const yearsSet = new Set<number>();
  const yearUtc = (options?.now ?? new Date()).getUTCFullYear();
  let wonThisYear = 0;
  const categoryCount = new Map<string, number>();
  for (const row of rows) {
    const total = lotTotalMajorUnits(row.lot);
    totalSpent += total;
    if (row.payment?.status !== "captured" && row.payment?.status !== "refunded") {
      outstanding += total;
    }
    const year = row.lot.endTime.getUTCFullYear();
    yearsSet.add(year);
    if (year === yearUtc) wonThisYear += 1;
    const cat = row.lot.categoryId;
    if (cat) categoryCount.set(cat, (categoryCount.get(cat) ?? 0) + 1);
  }
  return {
    totalRows: rows.length,
    totalSpentFormatted: formatMoney(totalSpent.toFixed(2)),
    outstandingFormatted: formatMoney(outstanding.toFixed(2)),
    wonThisYear,
    years: Array.from(yearsSet).sort((a, b) => b - a),
    categoryCounts: Array.from(categoryCount.entries())
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export function toPortfolioLotCards(
  rows: PortfolioRow[],
  options: { artistNameById?: Record<string, string> } = {},
): PortfolioLotCardVm[] {
  const { artistNameById = {} } = options;
  return rows.map((row) => {
    const a = row.lot;
    const img = a.images[0];
    const cp = a.checkoutPricing;
    const premium = cp ? Number.parseFloat(cp.premiumMajor) : Number.NaN;
    const total = cp ? Number.parseFloat(cp.totalMajor) : Number.NaN;
    const settlementLabel = portfolioSettlementLabel(row);
    const settlementStageIndex =
      settlementLabel === "Paid" || settlementLabel === "Payment authorized"
        ? 2
        : settlementLabel.includes("Refund")
          ? 0
          : 1;
    const artistName = a.artistId ? (artistNameById[a.artistId] ?? null) : null;
    const conditionReportUrl =
      typeof a.marketingDetails?.conditionReport?.downloadUrl === "string"
        ? a.marketingDetails.conditionReport.downloadUrl
        : null;
    return {
      id: a.id,
      title: a.title,
      artistName,
      image: img ?? null,
      hammerLabel: cp ? formatMoney(cp.hammerMajor) : formatMoney(a.currentPrice),
      premiumLabel: formatMoney((Number.isFinite(premium) ? premium : 0).toFixed(2)),
      totalLabel: Number.isFinite(total) ? formatMoney(total.toFixed(2)) : "—",
      dueLabel: row.payment?.status === "captured" ? "Paid" : "Due now",
      settlementLabel,
      settlementStageIndex,
      medium: a.medium,
      dimensions: a.dimensions,
      paymentStatus: row.payment?.status ?? null,
      checkoutHref: `/dashboard/checkout/${a.id}`,
      conditionReportUrl,
      endYear: a.endTime.getUTCFullYear(),
    };
  });
}
