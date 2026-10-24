import { buildListHref } from "@/lib/admin/admin-list-params";
import { manualReviewReasonLabel } from "@/lib/admin/manual-review-presenter";
import { toStaffStatus } from "@/lib/admin/staff-kit-status";
import type { AdminManualReviewPaymentRow } from "@/lib/data/http/admin-ops-dashboard.types";
import type { AdminPaymentTableRow } from "@/lib/data/view-models/admin-payments-table.vm";
import {
  lotFulfilmentStatusLabel,
  paymentStatusLabel,
  paymentStatusToBadgeVariant,
  resolveStatusPresentation,
} from "@/lib/presenters/status-presentation";
import {
  type AttentionStripItem,
  type Metric,
  type DataView as StaffDataView,
  type StatusPresentation,
  formatStaffMoney,
  parsePoundsToPence,
} from "@auction/staff-ui";
import type { PaymentStatus } from "@auction/types";

export const PAYMENTS_LIST_PATH = "/admin/payments";

export type PaymentsListSearch = Record<string, string | string[] | undefined>;

/** "£4,140.00" from the API's pounds string; the raw text when it is not a plain amount. */
export function formatPaymentAmount(amount: string): string {
  const parsed = parsePoundsToPence(amount);
  return parsed.ok ? formatStaffMoney(parsed.pence) : amount;
}

/** One payment as the staff list shows it; plain data, so it crosses to the client as is. */
export type PaymentsStaffRow = {
  id: string;
  lotId: string;
  lotTitle: string;
  buyerId: string;
  buyer: string;
  sellerId: string;
  amount: string;
  amountPence: number | null;
  platformFee: string;
  status: PaymentStatus;
  statusPresentation: StatusPresentation;
  fulfilment: StatusPresentation | null;
  createdAt: string | null;
  xero: {
    invoiceNumber: string | null;
    invoiceUrl: string | null;
    syncStatus: AdminPaymentTableRow["xeroSyncStatus"];
    lastError: string | null;
  };
  /** Capture is offered while the money is held, not yet taken. */
  canCapture: boolean;
  /** Refund is offered once the money has been taken, and only once. */
  canRefund: boolean;
};

export function presentPaymentStatus(status: PaymentStatus): StatusPresentation {
  return toStaffStatus(paymentStatusToBadgeVariant(status), paymentStatusLabel[status] ?? status);
}

export function toPaymentsStaffRows(rows: readonly AdminPaymentTableRow[]): PaymentsStaffRow[] {
  return rows.map((row) => {
    const pence = parsePoundsToPence(row.amount);
    const fulfilment = row.fulfilmentStatus
      ? resolveStatusPresentation("fulfilment", row.fulfilmentStatus)
      : null;
    return {
      id: row.id,
      lotId: row.lotId,
      lotTitle: row.lotTitle,
      buyerId: row.buyerId,
      buyer: row.buyerLabel?.trim() || "Buyer",
      sellerId: row.sellerId,
      amount: formatPaymentAmount(row.amount),
      amountPence: pence.ok ? pence.pence : null,
      platformFee: formatPaymentAmount(row.platformFee),
      status: row.status,
      statusPresentation: presentPaymentStatus(row.status),
      fulfilment: fulfilment ? toStaffStatus(fulfilment.variant, fulfilment.label) : null,
      createdAt: row.createdAt,
      xero: {
        invoiceNumber: row.xeroInvoiceNumber,
        invoiceUrl: row.xeroOnlineInvoiceUrl,
        syncStatus: row.xeroSyncStatus,
        lastError: row.xeroLastError,
      },
      canCapture: row.status === "pending" || row.status === "authorized",
      canRefund: row.status === "captured",
    };
  });
}

/** One held payment in the manual review queue, as the staff list shows it. */
export type ManualReviewStaffRow = {
  id: string;
  lotId: string;
  lotTitle: string;
  lotNumber: number | null;
  winnerId: string;
  winner: string;
  seller: string;
  amount: string;
  reason: string;
  compliance: boolean;
  source: AdminManualReviewPaymentRow;
};

const COMPLIANCE_REASONS = new Set(["aml_hold", "source_of_funds_required"]);

export function toManualReviewStaffRows(
  rows: readonly AdminManualReviewPaymentRow[],
): ManualReviewStaffRow[] {
  return rows.map((row) => ({
    id: row.paymentId,
    lotId: row.lotId,
    lotTitle: row.lotTitle,
    lotNumber: row.lotNumber,
    winnerId: row.winnerUserId,
    winner: row.winnerEmail?.trim() || "Buyer",
    seller: row.sellerDisplayName,
    amount: formatPaymentAmount(row.amount),
    reason: manualReviewReasonLabel(row.manualReviewReason),
    compliance: COMPLIANCE_REASONS.has(row.manualReviewReason ?? ""),
    source: row,
  }));
}

/** A link to the payments list with some of its URL state changed; paging restarts. */
export function paymentsListHref(
  search: PaymentsListSearch,
  patch: Record<string, string | number | null | undefined>,
): string {
  const base: PaymentsListSearch = { ...search };
  for (const key of ["error", "success", "period", "paymentId"]) delete base[key];
  return buildListHref(PAYMENTS_LIST_PATH, base, {
    ...("offset" in patch ? {} : { offset: null }),
    ...patch,
  });
}

/** The status views, in the order money moves through them. */
export const PAYMENT_STATUS_VIEWS: readonly PaymentStatus[] = [
  "pending",
  "authorized",
  "captured",
  "refunded",
];

export type PaymentsViewId = "all" | PaymentStatus | "manual-review";

export function activePaymentsView(search: PaymentsListSearch): PaymentsViewId {
  if (search.manualReview === "1") return "manual-review";
  const status = typeof search.status === "string" ? search.status : "";
  return (PAYMENT_STATUS_VIEWS as readonly string[]).includes(status)
    ? (status as PaymentStatus)
    : "all";
}

/**
 * The list's views as tabs. Only the manual review queue carries a count, because it is the only
 * view that is work waiting on someone.
 */
export function paymentsViews(
  search: PaymentsListSearch,
  manualReviewCount: number,
): StaffDataView[] {
  const reset = {
    manualReview: null,
    manualReviewReason: null,
    status: null,
    q: null,
    fulfilment: null,
    xero: null,
  };
  return [
    { id: "all", label: "All", href: paymentsListHref(search, reset) },
    ...PAYMENT_STATUS_VIEWS.map((status) => ({
      id: status,
      label: paymentStatusLabel[status],
      href: paymentsListHref(search, { ...reset, status }),
    })),
    {
      id: "manual-review",
      label: "Manual review",
      href: paymentsListHref(search, { ...reset, manualReview: "1" }),
      ...(manualReviewCount > 0 ? { count: manualReviewCount } : {}),
    },
  ];
}

/** Work waiting on the payments desk, each linking to the view that holds it. */
export function paymentsAttention(
  search: PaymentsListSearch,
  counts: { manualReviewCount: number; disputesOpen: number },
  view: PaymentsViewId,
): AttentionStripItem[] {
  return [
    ...(view === "manual-review"
      ? []
      : [
          {
            id: "manual-review",
            count: counts.manualReviewCount,
            label:
              counts.manualReviewCount === 1
                ? "payment needs manual review"
                : "payments need manual review",
            href: paymentsListHref(search, {
              manualReview: "1",
              manualReviewReason: null,
              status: null,
              q: null,
            }),
            tone: "warning" as const,
          },
        ]),
    {
      id: "disputes",
      count: counts.disputesOpen,
      label: counts.disputesOpen === 1 ? "dispute is open" : "disputes are open",
      href: "/admin/disputes",
      actionLabel: "Resolve",
      tone: "danger" as const,
    },
  ];
}

/** The summary over the payments that match the current view and search, in full pounds. */
export function paymentsMetrics(summary: {
  totalVolume: number;
  pending: number;
  captured: number;
  refunded: number;
}): Metric[] {
  const money = (pounds: number) => formatStaffMoney(Math.round(pounds * 100));
  return [
    { id: "volume", label: "Volume", value: money(summary.totalVolume) },
    { id: "awaiting", label: "Awaiting capture", value: money(summary.pending) },
    { id: "captured", label: "Captured", value: money(summary.captured) },
    { id: "refunded", label: "Refunded", value: money(summary.refunded) },
  ];
}

export function manualReviewMetrics(summary: {
  total: number;
  financeHolds: number;
  complianceHolds: number;
}): Metric[] {
  const count = new Intl.NumberFormat("en-GB");
  return [
    { id: "total", label: "Held payments", value: count.format(summary.total) },
    { id: "finance", label: "Finance holds", value: count.format(summary.financeHolds) },
    { id: "compliance", label: "Compliance holds", value: count.format(summary.complianceHolds) },
  ];
}

/** Hold reasons as the manual review queue filters them. */
export const MANUAL_REVIEW_REASON_FILTERS = [
  { value: "finance", label: "Finance holds" },
  { value: "compliance", label: "Compliance holds" },
  { value: "aml_hold", label: manualReviewReasonLabel("aml_hold") },
  { value: "source_of_funds_required", label: manualReviewReasonLabel("source_of_funds_required") },
] as const;

/** Lot fulfilment, as the payments filter sheet offers it, in the order a lot moves through it. */
export const PAYMENT_FULFILMENT_FILTERS = (
  [
    "awaiting_payment",
    "awaiting_release",
    "released",
    "ready_for_collection",
    "in_transit",
    "delivered",
    "cancelled",
  ] as const
).map((value) => ({ value, label: lotFulfilmentStatusLabel[value] }));

export const PAYMENT_XERO_FILTERS = [
  { value: "linked", label: "Invoice linked" },
  { value: "missing", label: "No invoice yet" },
  { value: "sync_error", label: "Last sync failed" },
] as const;

const listParam = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : "";

/** The filters in force beyond the status view, as chips, each with the link that removes it. */
export function paymentsFilterChips(
  search: PaymentsListSearch,
): Array<{ id: string; label: string; clearHref: string }> {
  const q = listParam(search.q);
  const fulfilment = listParam(search.fulfilment)
    .split(",")
    .map((value) => PAYMENT_FULFILMENT_FILTERS.find((option) => option.value === value)?.label)
    .filter((label): label is string => Boolean(label));
  const xero = PAYMENT_XERO_FILTERS.find((option) => option.value === listParam(search.xero));
  return [
    ...(q ? [{ id: "q", label: `“${q}”`, clearHref: paymentsListHref(search, { q: null }) }] : []),
    ...(fulfilment.length > 0
      ? [
          {
            id: "fulfilment",
            label: `Fulfilment: ${fulfilment.join(", ")}`,
            clearHref: paymentsListHref(search, { fulfilment: null }),
          },
        ]
      : []),
    ...(xero
      ? [
          {
            id: "xero",
            label: `Xero: ${xero.label}`,
            clearHref: paymentsListHref(search, { xero: null }),
          },
        ]
      : []),
  ];
}

/** "1–50 of 312 payments". */
export function paymentsRangeSummary(offset: number, shown: number, total: number): string {
  const count = new Intl.NumberFormat("en-GB");
  const noun = total === 1 ? "payment" : "payments";
  return `${count.format(offset + 1)}–${count.format(offset + shown)} of ${count.format(total)} ${noun}`;
}
