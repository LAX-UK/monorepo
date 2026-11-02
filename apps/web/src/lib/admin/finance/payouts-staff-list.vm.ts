import { buildListHref } from "@/lib/admin/admin-list-params";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type { AdminPayoutListSummary } from "@/lib/data/http/admin-payouts.shared";
import type { AdminPayoutRow } from "@/lib/data/http/admin.server";
import {
  type AttentionStripItem,
  type Metric,
  type DataView as StaffDataView,
  type StatusPresentation,
  formatStaffDate,
  formatStaffMoney,
  parsePoundsToPence,
} from "@auction/staff-ui";
import { type PayoutStatus, payoutStatuses } from "@auction/types";

export const PAYOUTS_LIST_PATH = "/admin/payouts";

export type PayoutsListSearch = Record<string, string | string[] | undefined>;

/** "£4,140.00" from the API's pounds string; the raw text when it is not a plain amount. */
export function formatPayoutAmount(amount: string, currency = "GBP"): string {
  const parsed = parsePoundsToPence(amount.startsWith("-") ? amount.slice(1) : amount);
  if (!parsed.ok) return amount;
  return formatStaffMoney(amount.startsWith("-") ? -parsed.pence : parsed.pence, currency);
}

function poundsToPence(amount: string): number | null {
  const negative = amount.startsWith("-");
  const parsed = parsePoundsToPence(negative ? amount.slice(1) : amount);
  if (!parsed.ok) return null;
  return negative ? -parsed.pence : parsed.pence;
}

/** One payout as the staff list shows it; plain data, so it crosses to the client as is. */
export type PayoutsStaffRow = {
  id: string;
  legalEntityId: string;
  /** The seller's name; a short reference when the name could not be looked up. */
  seller: string;
  /** "1 Oct 2026 – 31 Oct 2026". */
  period: string;
  periodStart: string;
  gross: string;
  platformFee: string;
  stripeFee: string;
  net: string;
  netPence: number | null;
  status: PayoutStatus;
  statusPresentation: StatusPresentation;
  stripeTransferId: string | null;
  failureReason: string | null;
  statementError: string | null;
  /** When the money went out; null until the payout is paid, and for one never paid. */
  paidAt: string | null;
  createdAt: string;
  /** Money moves out only while the payout is open (scheduled or in transit). */
  canMarkPaid: boolean;
  canAdjust: boolean;
  /** Reversal is a bookkeeping step for payouts that are paid or on their way. */
  canReverse: boolean;
  /** A failed transfer can be sent again. */
  canRetryTransfer: boolean;
};

export function presentPayoutStatus(status: PayoutStatus): StatusPresentation {
  return staffStatus("payout", status);
}

/** Settlements that cover everything up to a date store the epoch as their start. */
const OPEN_PERIOD_START_BEFORE_MS = 86_400_000;

export function payoutPeriod(start: string, end: string): string {
  const startMs = Date.parse(start);
  if (Number.isNaN(startMs) || startMs < OPEN_PERIOD_START_BEFORE_MS) {
    return `Up to ${formatStaffDate(end)}`;
  }
  return `${formatStaffDate(start)} – ${formatStaffDate(end)}`;
}

/** A short reference for a seller whose name is not known. */
function sellerFallback(legalEntityId: string): string {
  return `Seller ${legalEntityId.slice(0, 8)}`;
}

/**
 * The date a payout was paid. Only a paid payout (or one being clawed back after it was paid)
 * has one: a scheduled, in-transit, failed or reversed payout shows none, even when the row
 * carries an older processing time.
 */
export function payoutPaidAt(row: Pick<AdminPayoutRow, "status" | "processedAt">): string | null {
  return row.status === "paid" || row.status === "clawback_pending" ? row.processedAt : null;
}

export function toPayoutsStaffRows(
  rows: readonly AdminPayoutRow[],
  sellerNames: ReadonlyMap<string, string> = new Map(),
): PayoutsStaffRow[] {
  return rows.map((row) => {
    const open = row.status === "scheduled" || row.status === "in_transit";
    return {
      id: row.id,
      legalEntityId: row.legalEntityId,
      seller:
        row.legalEntityName ??
        sellerNames.get(row.legalEntityId) ??
        sellerFallback(row.legalEntityId),
      period: payoutPeriod(row.periodStart, row.periodEnd),
      periodStart: row.periodStart,
      gross: formatPayoutAmount(row.grossAmount, row.currency),
      platformFee: formatPayoutAmount(row.platformFee, row.currency),
      stripeFee: formatPayoutAmount(row.stripeFee, row.currency),
      net: formatPayoutAmount(row.netAmount, row.currency),
      netPence: poundsToPence(row.netAmount),
      status: row.status,
      statusPresentation: presentPayoutStatus(row.status),
      stripeTransferId: row.stripeTransferId,
      failureReason: row.failureReason,
      statementError: row.statementGenerationError,
      paidAt: payoutPaidAt(row),
      createdAt: row.createdAt,
      canMarkPaid: open,
      canAdjust: open,
      canReverse: row.status === "paid" || row.status === "in_transit",
      canRetryTransfer: row.status === "failed",
    };
  });
}

/** A link to the payouts list with some of its URL state changed; paging restarts. */
export function payoutsListHref(
  search: PayoutsListSearch,
  patch: Record<string, string | number | null | undefined>,
): string {
  const base: PayoutsListSearch = { ...search };
  for (const key of ["error", "success", "period", "settlement", "payout"]) delete base[key];
  return buildListHref(PAYOUTS_LIST_PATH, base, {
    ...("offset" in patch ? {} : { offset: null }),
    ...patch,
  });
}

/** The list with a payout's panel open (`?payout=`), or closed when `payoutId` is null; keeps the page. */
export function payoutPanelHref(search: PayoutsListSearch, payoutId: string | null): string {
  const base: PayoutsListSearch = { ...search };
  for (const key of ["error", "success", "period", "settlement"]) delete base[key];
  return buildListHref(PAYOUTS_LIST_PATH, base, { payout: payoutId });
}

export type PayoutsViewId = "all" | PayoutStatus;

export function activePayoutsView(search: PayoutsListSearch): PayoutsViewId {
  const status = typeof search.status === "string" ? search.status : "";
  return (payoutStatuses as readonly string[]).includes(status) ? (status as PayoutStatus) : "all";
}

/** The status views, in the order a payout moves through them. */
export function payoutsViews(search: PayoutsListSearch): StaffDataView[] {
  return [
    { id: "all", label: "All", href: payoutsListHref(search, { status: null }) },
    ...payoutStatuses.map((status) => ({
      id: status,
      label: presentPayoutStatus(status).label,
      href: payoutsListHref(search, { status }),
    })),
  ];
}

/** Work waiting on the finance desk, each linking to the view that holds it. */
export function payoutsAttention(
  search: PayoutsListSearch,
  summary: AdminPayoutListSummary,
  disputesOpen: number,
): AttentionStripItem[] {
  const failed = summary.readiness.failedCount;
  const noun = (count: number, one: string, many: string) => (count === 1 ? one : many);
  return [
    {
      id: "failed",
      count: failed,
      label: noun(failed, "payout failed", "payouts failed"),
      href: payoutsListHref(search, { status: "failed" }),
      tone: "danger",
    },
    {
      id: "clawback",
      count: summary.clawbackPending,
      label: noun(
        summary.clawbackPending,
        "payout needs funds recovered",
        "payouts need funds recovered",
      ),
      href: payoutsListHref(search, { status: "clawback_pending" }),
      actionLabel: "Resolve",
      tone: "danger",
    },
    {
      id: "blockers",
      count: summary.readiness.blockerPayoutCount,
      label: noun(
        summary.readiness.blockerPayoutCount,
        "payout has a settlement blocker",
        "payouts have settlement blockers",
      ),
      href: "/admin/payouts/settlement",
      actionLabel: "Open settlement",
      tone: "warning",
    },
    {
      id: "disputes",
      count: disputesOpen,
      label: noun(disputesOpen, "dispute is open", "disputes are open"),
      href: "/admin/disputes",
      actionLabel: "Resolve",
      tone: "warning",
    },
  ];
}

/** The summary over the payouts that match the current view and filters. */
export function payoutsMetrics(summary: AdminPayoutListSummary): Metric[] {
  const count = new Intl.NumberFormat("en-GB");
  const net = Number.parseFloat(summary.totalNet);
  return [
    { id: "scheduled", label: "Scheduled", value: count.format(summary.scheduled) },
    { id: "in-transit", label: "In transit", value: count.format(summary.inTransit) },
    {
      id: "net",
      label: "Net payable",
      value: formatStaffMoney(Math.round((Number.isFinite(net) ? net : 0) * 100)),
    },
    {
      id: "attention",
      label: "Failed or clawback",
      value: count.format(summary.failed + summary.clawbackPending),
    },
  ];
}

/** The filters in force beyond the status view, as chips, each with the link that removes it. */
export function payoutsFilterChips(
  search: PayoutsListSearch,
  sellerName: string | null,
): Array<{ id: string; label: string; clearHref: string }> {
  const legalEntityId = typeof search.legalEntityId === "string" ? search.legalEntityId : "";
  if (!legalEntityId) return [];
  return [
    {
      id: "legalEntityId",
      label: `Seller: ${sellerName ?? sellerFallback(legalEntityId)}`,
      clearHref: payoutsListHref(search, { legalEntityId: null }),
    },
  ];
}

export type SignedPounds = { ok: true; pence: number; amount: string } | { ok: false };

/**
 * A signed amount typed in pounds ("-25", "£40.50", "−25.00") as whole pence and as the API's
 * decimal string. Zero is not an adjustment, and more than two decimals is refused, not rounded.
 */
export function parseSignedPounds(input: string): SignedPounds {
  const text = input.trim().replace(/^−/, "-");
  const negative = text.startsWith("-");
  const parsed = parsePoundsToPence(negative ? text.slice(1).trim() : text);
  if (!parsed.ok || parsed.pence === 0) return { ok: false };
  const pence = negative ? -parsed.pence : parsed.pence;
  const abs = Math.abs(pence);
  const amount = `${negative ? "-" : ""}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
  return { ok: true, pence, amount };
}

/** "1–50 of 312 payouts". */
export function payoutsRangeSummary(offset: number, shown: number, total: number): string {
  const count = new Intl.NumberFormat("en-GB");
  const noun = total === 1 ? "payout" : "payouts";
  return `${count.format(offset + 1)}–${count.format(offset + shown)} of ${count.format(total)} ${noun}`;
}
