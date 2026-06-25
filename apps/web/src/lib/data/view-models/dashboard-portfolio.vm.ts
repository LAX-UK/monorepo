import type { PortfolioLotCardVm } from "@/components/dashboard/portfolio-lot-grid";
import { dashboardCheckoutLotUrl } from "@/lib/dashboard/dashboard-copy";
import type { ComplianceGateStatus } from "@/lib/data/http/payments.server";
import { PLATFORM_DEFAULT_CURRENCY, formatMoney, resolveLotCurrency } from "@/lib/format-currency";
import { portfolioComplianceReason, portfolioSettlementLabel } from "@/lib/portfolio-settlement";
import type { ManualReviewReason, PortfolioRow } from "@auction/types";
import { INVOICE_PAYMENT_DUE_DAYS } from "@auction/types";
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
    totalSpentFormatted: formatMoney(totalSpent.toFixed(2), PLATFORM_DEFAULT_CURRENCY),
    outstandingFormatted: formatMoney(outstanding.toFixed(2), PLATFORM_DEFAULT_CURRENCY),
    hasOutstanding: outstanding > 0,
    wonThisYear,
    years: Array.from(yearsSet).sort((a, b) => b - a),
    categoryCounts: Array.from(categoryCount.entries())
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count),
  };
}

/** A won lot still needs checkout when it is not yet captured or refunded. */
function isAwaitingCheckout(row: PortfolioRow): boolean {
  const status = row.payment?.status ?? null;
  return status !== "captured" && status !== "refunded";
}

function portfolioDueColumnLabel(row: PortfolioRow): string {
  const status = row.payment?.status ?? null;
  if (status === "captured") return "Paid";
  if (row.payment?.createdAt) {
    const due = new Date(row.payment.createdAt);
    due.setUTCDate(due.getUTCDate() + INVOICE_PAYMENT_DUE_DAYS);
    return `Due ${new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(due)}`;
  }
  return status === "pending" || status === "authorized" ? "Due now" : "Total due";
}

export function toPortfolioLotCards(
  rows: PortfolioRow[],
  options: {
    artistNameById?: Record<string, string>;
    /** User-level compliance gate; blocks all not-yet-paid lots when active. */
    complianceGate?: ComplianceGateStatus;
  } = {},
): PortfolioLotCardVm[] {
  const { artistNameById = {}, complianceGate = "clear" } = options;
  const gateReason: ManualReviewReason | null =
    complianceGate === "aml_hold" || complianceGate === "source_of_funds_required"
      ? complianceGate
      : null;
  return rows.map((row) => {
    const a = row.lot;
    const img = a.images[0];
    const cp = a.checkoutPricing;
    const premium = cp ? Number.parseFloat(cp.premiumMajor) : Number.NaN;
    const total = cp ? Number.parseFloat(cp.totalMajor) : Number.NaN;
    // Per-payment reason takes precedence; otherwise fall back to the user-level
    // gate for lots that still require checkout (covers the pre-payment-row case).
    const complianceReason =
      portfolioComplianceReason(row) ?? (isAwaitingCheckout(row) ? gateReason : null);
    const settlementLabel = complianceReason ? "Compliance review" : portfolioSettlementLabel(row);
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
    const currency = resolveLotCurrency(a);
    return {
      id: a.id,
      title: a.title,
      artistName,
      image: img ?? null,
      hammerLabel: cp
        ? formatMoney(cp.hammerMajor, currency)
        : formatMoney(a.currentPrice, currency),
      premiumLabel: formatMoney((Number.isFinite(premium) ? premium : 0).toFixed(2), currency),
      totalLabel: Number.isFinite(total) ? formatMoney(total.toFixed(2), currency) : "—",
      dueLabel: portfolioDueColumnLabel(row),
      settlementLabel,
      settlementStageIndex,
      medium: a.medium,
      dimensions: a.dimensions,
      paymentStatus: row.payment?.status ?? null,
      checkoutHref: dashboardCheckoutLotUrl(a.id),
      conditionReportUrl,
      endYear: a.endTime.getUTCFullYear(),
      complianceReason,
    };
  });
}
