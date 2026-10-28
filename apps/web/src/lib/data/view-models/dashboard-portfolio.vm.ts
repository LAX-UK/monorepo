import { DASHBOARD_ROUTES, dashboardCheckoutLotUrl } from "@/lib/dashboard/dashboard-copy";
import type { ComplianceGateStatus } from "@/lib/data/http/payments.server";
import { PLATFORM_DEFAULT_CURRENCY, formatMoney } from "@/lib/format-currency";
import { portfolioComplianceReason } from "@/lib/portfolio-settlement";
import type { ManualReviewReason, PortfolioRow } from "@auction/types";
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
  hasOutstanding: boolean;
  /** Sorted years available in the portfolio. Used for the year filter. */
  years: number[];
  /** Map of category id -> count (for high-level summary). */
  categoryCounts: { id: string; count: number }[];
};

export function buildPortfolioAnalytics(rows: readonly PortfolioRow[]): PortfolioAnalyticsVm {
  let totalSpent = 0;
  let outstanding = 0;
  const yearsSet = new Set<number>();
  const categoryCount = new Map<string, number>();
  for (const row of rows) {
    const total = lotTotalMajorUnits(row.lot);
    totalSpent += total;
    if (row.payment?.status !== "captured" && row.payment?.status !== "refunded") {
      outstanding += total;
    }
    const year = row.lot.endTime.getUTCFullYear();
    yearsSet.add(year);
    const cat = row.lot.categoryId;
    if (cat) categoryCount.set(cat, (categoryCount.get(cat) ?? 0) + 1);
  }
  return {
    totalRows: rows.length,
    totalSpentFormatted: formatMoney(totalSpent.toFixed(2), PLATFORM_DEFAULT_CURRENCY),
    outstandingFormatted: formatMoney(outstanding.toFixed(2), PLATFORM_DEFAULT_CURRENCY),
    hasOutstanding: outstanding > 0,
    years: Array.from(yearsSet).sort((a, b) => b - a),
    categoryCounts: Array.from(categoryCount.entries())
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count),
  };
}

/** A won lot that still has to be paid for. */
export function isAwaitingCheckout(row: Pick<PortfolioRow, "payment">): boolean {
  const status = row.payment?.status ?? null;
  return status !== "captured" && status !== "refunded";
}

/** Reason a not-yet-paid lot is held for review; the user-level gate covers lots with no payment row yet. */
function awaitingComplianceReason(
  row: PortfolioRow,
  complianceGate: ComplianceGateStatus,
): ManualReviewReason | null {
  const gateReason: ManualReviewReason | null =
    complianceGate === "aml_hold" || complianceGate === "source_of_funds_required"
      ? complianceGate
      : null;
  return portfolioComplianceReason(row) ?? (isAwaitingCheckout(row) ? gateReason : null);
}

export type PayNowVm = {
  /** Won lots that still need paying, whether or not they can be paid yet. */
  dueCount: number;
  outstandingLabel: string;
  /** Checkout for every lot that can be paid now; null while all of them are in review. */
  href: string | null;
};

/** What to pin at the top of Purchases when something is due; null when nothing is. */
export function buildPayNow(
  rows: readonly PortfolioRow[],
  complianceGate: ComplianceGateStatus = "clear",
): PayNowVm | null {
  const due = rows.filter(isAwaitingCheckout);
  if (due.length === 0) return null;
  const payableIds = due
    .filter((row) => awaitingComplianceReason(row, complianceGate) === null)
    .map((row) => row.lot.id);
  const [onlyId] = payableIds;
  let href: string | null = null;
  if (onlyId && payableIds.length === 1) href = dashboardCheckoutLotUrl(onlyId);
  else if (payableIds.length > 1)
    href = `${DASHBOARD_ROUTES.checkout}?lots=${payableIds.join(",")}`;
  return {
    dueCount: due.length,
    outstandingLabel: buildPortfolioAnalytics(due).outstandingFormatted,
    href,
  };
}
