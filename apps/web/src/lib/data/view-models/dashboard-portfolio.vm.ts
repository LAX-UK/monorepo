import { PLATFORM_DEFAULT_CURRENCY, formatMoney, lotChargeCurrency } from "@/lib/format-currency";
import { purchaseEnding, sumMoneyByCurrency } from "@auction/domain";
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
      return status !== "captured" && status !== "refunded" && status !== "cancelled";
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
  hasOutstanding: boolean;
  /** Sorted years available in the portfolio. Used for the year filter. */
  years: number[];
  /** Map of category id -> count (for high-level summary). */
  categoryCounts: { id: string; count: number }[];
};

/**
 * What a set of won lots comes to, in each lot's own currency ("US$7,200.00 + £1,250.00").
 * Lots sold in different currencies are never added together.
 */
function formatTotals(rows: readonly PortfolioRow[]): string {
  const totals = sumMoneyByCurrency(
    rows.map((row) => ({
      currency: lotChargeCurrency(row.lot),
      amount: lotTotalMajorUnits(row.lot).toFixed(2),
    })),
  );
  if (totals.length === 0) return formatMoney("0.00", PLATFORM_DEFAULT_CURRENCY);
  return totals.map((total) => formatMoney(total.amount, total.currency)).join(" + ");
}

export function buildPortfolioAnalytics(rows: readonly PortfolioRow[]): PortfolioAnalyticsVm {
  const yearsSet = new Set<number>();
  const categoryCount = new Map<string, number>();
  for (const row of rows) {
    yearsSet.add(row.lot.endTime.getUTCFullYear());
    const cat = row.lot.categoryId;
    if (cat) categoryCount.set(cat, (categoryCount.get(cat) ?? 0) + 1);
  }
  const outstanding = rows.filter(
    (row) =>
      row.payment?.status !== "captured" &&
      !purchaseEnding({ paymentStatus: row.payment?.status ?? null }),
  );
  return {
    totalRows: rows.length,
    totalSpentFormatted: formatTotals(rows),
    outstandingFormatted: formatTotals(outstanding),
    hasOutstanding: outstanding.some((row) => lotTotalMajorUnits(row.lot) > 0),
    years: Array.from(yearsSet).sort((a, b) => b - a),
    categoryCounts: Array.from(categoryCount.entries())
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count),
  };
}
