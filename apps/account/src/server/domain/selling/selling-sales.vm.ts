import { formatDate } from "@/lib/format-money";
import type { PortalPayout, PortalSaleStatement } from "@auction/shop-contracts";
import { type PayoutStatusVm, describePayoutStatus } from "./selling-payout-status";

/** Shop's sales channels, as a seller would say where the edition sold. */
export const SALE_CHANNEL_LABELS: Record<PortalSaleStatement["channel"], string> = {
  direct: "LAX Shop",
  third_party: "Sold outside LAX",
  original: "lax.art",
};

export const SALES_PERIODS = ["all", "this-tax-year", "last-tax-year", "last-12-months"] as const;
export type SalesPeriod = (typeof SALES_PERIODS)[number];

export const SALES_PERIOD_LABELS: Record<SalesPeriod, string> = {
  all: "All time",
  "this-tax-year": "This tax year",
  "last-tax-year": "Last tax year",
  "last-12-months": "Last 12 months",
};

export function parseSalesPeriod(value: string | string[] | undefined): SalesPeriod {
  const raw = Array.isArray(value) ? value[0] : value;
  return (SALES_PERIODS as readonly string[]).includes(raw ?? "") ? (raw as SalesPeriod) : "all";
}

type Range = { fromMs: number; toMs: number };

/** The UK tax year (6 April to 5 April) that `nowMs` falls in, offset by whole years. */
function taxYear(nowMs: number, offset: number): Range {
  const now = new Date(nowMs);
  const year = now.getUTCFullYear();
  const startsThisYear = nowMs >= Date.UTC(year, 3, 6);
  const startYear = (startsThisYear ? year : year - 1) + offset;
  return { fromMs: Date.UTC(startYear, 3, 6), toMs: Date.UTC(startYear + 1, 3, 6) };
}

export function salesPeriodRange(period: SalesPeriod, nowMs: number): Range | null {
  switch (period) {
    case "all":
      return null;
    case "this-tax-year":
      return taxYear(nowMs, 0);
    case "last-tax-year":
      return taxYear(nowMs, -1);
    case "last-12-months": {
      const now = new Date(nowMs);
      return {
        fromMs: Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate() + 1),
        toMs: Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
      };
    }
  }
}

/** "6 Apr 2026 to 5 Apr 2027", or null for all time. */
export function describeSalesPeriod(period: SalesPeriod, nowMs: number): string | null {
  const range = salesPeriodRange(period, nowMs);
  if (!range) return null;
  const last = new Date(range.toMs - 86_400_000).toISOString();
  return `${formatDate(new Date(range.fromMs).toISOString())} to ${formatDate(last)}`;
}

export type SaleRowVm = {
  saleId: string;
  title: string;
  edition: string | null;
  soldOn: string;
  soldAtIso: string;
  channel: string;
  salePricePence: number;
  feesPence: number;
  netPence: number;
  payout: PayoutStatusVm;
};

export type SalesSummaryVm = {
  count: number;
  salePricePence: number;
  feesPence: number;
  netPence: number;
  paidOutPence: number;
  toComePence: number;
};

export type SalesPageVm = {
  period: SalesPeriod;
  periodRange: string | null;
  rows: SaleRowVm[];
  summary: SalesSummaryVm;
  /** Sales exist, but none in the chosen period. */
  noneInPeriod: boolean;
  totalCount: number;
};

export function buildSaleRows(
  sales: readonly PortalSaleStatement[],
  payouts: readonly PortalPayout[],
): SaleRowVm[] {
  const payoutById = new Map(payouts.map((payout) => [payout.payoutId, payout]));
  return [...sales]
    .sort((a, b) => (a.soldAt < b.soldAt ? 1 : -1))
    .map((sale) => ({
      saleId: sale.saleId,
      title: sale.artworkTitle,
      edition: sale.editionNumber != null ? `Edition ${sale.editionNumber}` : null,
      soldOn: formatDate(sale.soldAt),
      soldAtIso: sale.soldAt,
      channel: SALE_CHANNEL_LABELS[sale.channel] ?? "LAX",
      salePricePence: sale.grossPence,
      feesPence: sale.feesPence,
      netPence: sale.netPence,
      payout: describePayoutStatus(sale.payoutStatus, payoutById.get(sale.payoutId) ?? null),
    }));
}

export function summariseSales(rows: readonly SaleRowVm[]): SalesSummaryVm {
  const summary: SalesSummaryVm = {
    count: rows.length,
    salePricePence: 0,
    feesPence: 0,
    netPence: 0,
    paidOutPence: 0,
    toComePence: 0,
  };
  for (const row of rows) {
    summary.salePricePence += row.salePricePence;
    summary.feesPence += row.feesPence;
    summary.netPence += row.netPence;
    if (row.payout.stage === "paid") summary.paidOutPence += row.netPence;
    if (row.payout.stage === "to_come") summary.toComePence += row.netPence;
  }
  return summary;
}

/**
 * The sales statement for a period: each sold edition with its payout's state, and totals for
 * the period. Shop records every sale in pounds, so the totals are one currency.
 */
export function buildSalesPage(
  sales: readonly PortalSaleStatement[],
  payouts: readonly PortalPayout[],
  period: SalesPeriod,
  nowMs: number,
): SalesPageVm {
  const all = buildSaleRows(sales, payouts);
  const range = salesPeriodRange(period, nowMs);
  const rows = range
    ? all.filter((row) => {
        const ms = Date.parse(row.soldAtIso);
        return ms >= range.fromMs && ms < range.toMs;
      })
    : all;
  return {
    period,
    periodRange: describeSalesPeriod(period, nowMs),
    rows,
    summary: summariseSales(rows),
    noneInPeriod: all.length > 0 && rows.length === 0,
    totalCount: all.length,
  };
}

const CSV_HEADER = [
  "Date sold",
  "Artwork",
  "Edition",
  "Where it sold",
  "Sale price (GBP)",
  "LAX fees (GBP)",
  "Net to you (GBP)",
  "Payout",
];

/** Quotes a cell, and stops a spreadsheet reading text that starts with = + - @ as a formula. */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

const pounds = (pence: number) => (pence / 100).toFixed(2);

/** The statement as CSV, one line per sale, dates as YYYY-MM-DD so spreadsheets sort them. */
export function salesStatementCsv(rows: readonly SaleRowVm[]): string {
  const lines = [CSV_HEADER.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.soldAtIso.slice(0, 10),
        row.title,
        row.edition ?? "",
        row.channel,
        pounds(row.salePricePence),
        pounds(row.feesPence),
        pounds(row.netPence),
        row.payout.label,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\r\n")}\r\n`;
}
