import { DASHBOARD_ROUTES, dashboardCheckoutLotUrl } from "@/lib/dashboard/dashboard-copy";
import type { ComplianceGateStatus } from "@/lib/data/http/payments.server";
import { PLATFORM_DEFAULT_CURRENCY, formatMoney, lotChargeCurrency } from "@/lib/format-currency";
import { portfolioComplianceReason } from "@/lib/portfolio-settlement";
import { isToPay } from "@/lib/purchases/purchase-progress";
import { purchaseEnding, sumMoneyByCurrency } from "@auction/domain";
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

/** A won lot that still has to be paid for: one in the To pay view of Purchases. */
export function isAwaitingCheckout(row: Pick<PortfolioRow, "payment">): boolean {
  return isToPay(row.payment?.status ?? null);
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
