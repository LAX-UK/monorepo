import { buildListHref } from "@/lib/admin/admin-list-params";
import { domainEventLabel } from "@/lib/admin/domain-event-labels";
import { isoDate, isoDateOrNull } from "@/lib/admin/iso-date";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type { AdminDisputeTableRow } from "@/lib/data/view-models/admin-disputes-table.vm";
import {
  type AttentionStripItem,
  type Metric,
  type DataView as StaffDataView,
  type StatusPresentation,
  type TimelineEvent,
  formatStaffMoney,
} from "@auction/staff-ui";
import type { AdminDisputeCaseSummary, DisputeCaseStatus } from "@auction/types";

export const DISPUTES_LIST_PATH = "/admin/disputes";

export type DisputesListSearch = Record<string, string | string[] | undefined>;

/** One dispute case as the staff list shows it; plain data, so it crosses to the client as is. */
export type DisputesStaffRow = {
  /** The Stripe dispute ID, which identifies the case. */
  id: string;
  paymentId: string;
  lotId: string | null;
  /** The lot's title; "Dispute case" when the payment's lot is not known. */
  title: string;
  reason: string;
  status: DisputeCaseStatus;
  statusPresentation: StatusPresentation;
  amount: string;
  amountCents: number;
  buyerId: string | null;
  buyer: string | null;
  sellerId: string;
  seller: string;
  openedAt: string;
  closedAt: string | null;
  timeline: TimelineEvent[];
};

export function presentDisputeStatus(status: DisputeCaseStatus): StatusPresentation {
  return staffStatus("dispute", status);
}

export function toDisputesStaffRows(rows: readonly AdminDisputeTableRow[]): DisputesStaffRow[] {
  return rows.map((row) => ({
    id: row.stripeDisputeId,
    paymentId: row.paymentId,
    lotId: row.lotId,
    title: row.lotTitle ?? "Dispute case",
    reason: row.reasonLabel,
    status: row.status,
    statusPresentation: presentDisputeStatus(row.status),
    amount: formatStaffMoney(row.amountCents, row.currency),
    amountCents: row.amountCents,
    buyerId: row.buyerId,
    buyer: row.buyerId ? row.buyerLabel?.trim() || "Buyer" : null,
    sellerId: row.sellerLegalEntityId,
    seller: row.sellerDisplayName?.trim() || `Seller ${row.sellerLegalEntityId.slice(0, 8)}`,
    openedAt: isoDate(row.openedAt),
    closedAt: isoDateOrNull(row.closedAt),
    timeline: [...(row.timelineEvents ?? [])]
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .map((event) => ({
        id: event.id,
        title: domainEventLabel(event.eventType),
        at: event.occurredAt,
        actor: "Stripe",
      })),
  }));
}

/** A link to the disputes list with some of its URL state changed; paging restarts. */
export function disputesListHref(
  search: DisputesListSearch,
  patch: Record<string, string | number | null | undefined>,
): string {
  const base: DisputesListSearch = { ...search };
  for (const key of ["error", "success", "dispute"]) delete base[key];
  return buildListHref(DISPUTES_LIST_PATH, base, {
    ...("offset" in patch ? {} : { offset: null }),
    ...patch,
  });
}

/** The list with a case's panel open (`?dispute=`), or closed when `disputeId` is null. */
export function disputePanelHref(search: DisputesListSearch, disputeId: string | null): string {
  const base: DisputesListSearch = { ...search };
  for (const key of ["error", "success"]) delete base[key];
  return buildListHref(DISPUTES_LIST_PATH, base, { dispute: disputeId });
}

export type DisputesViewId = "all" | "open" | "under_review" | "closed";

export function activeDisputesView(search: DisputesListSearch): DisputesViewId {
  const status = typeof search.status === "string" ? search.status : "";
  return status === "open" || status === "under_review" || status === "closed" ? status : "all";
}

/** The cases a view holds, from the queue-wide summary (the API pages without a total). */
export function disputesViewTotal(view: DisputesViewId, summary: AdminDisputeCaseSummary): number {
  switch (view) {
    case "open":
      return summary.open;
    case "under_review":
      return summary.underReview;
    case "closed":
      return summary.won + summary.lost + summary.closed;
    default:
      return summary.open + summary.underReview + summary.won + summary.lost + summary.closed;
  }
}

/** The status lenses as tabs; only the open cases are work waiting, so only they carry a count. */
export function disputesViews(
  search: DisputesListSearch,
  summary: AdminDisputeCaseSummary,
): StaffDataView[] {
  return [
    { id: "all", label: "All", href: disputesListHref(search, { status: null }) },
    {
      id: "open",
      label: "Open",
      href: disputesListHref(search, { status: "open" }),
      ...(summary.open > 0 ? { count: summary.open } : {}),
    },
    {
      id: "under_review",
      label: "Under review",
      href: disputesListHref(search, { status: "under_review" }),
    },
    { id: "closed", label: "Closed", href: disputesListHref(search, { status: "closed" }) },
  ];
}

/** Disputes waiting for a response, linking to the open cases. */
export function disputesAttention(
  search: DisputesListSearch,
  summary: AdminDisputeCaseSummary,
  view: DisputesViewId,
): AttentionStripItem[] {
  if (view === "open") return [];
  return [
    {
      id: "open",
      count: summary.open,
      label: summary.open === 1 ? "dispute needs a response" : "disputes need a response",
      href: disputesListHref(search, { status: "open" }),
      actionLabel: "Respond",
      tone: "danger",
    },
  ];
}

/** The queue-wide summary: it covers every dispute, not only the view being looked at. */
export function disputesMetrics(summary: AdminDisputeCaseSummary): Metric[] {
  const count = new Intl.NumberFormat("en-GB");
  return [
    { id: "open", label: "Open", value: count.format(summary.open) },
    { id: "under-review", label: "Under review", value: count.format(summary.underReview) },
    { id: "won", label: "Won", value: count.format(summary.won) },
    { id: "lost", label: "Lost", value: count.format(summary.lost) },
  ];
}

/** "1–50 of 312 disputes". */
export function disputesRangeSummary(offset: number, shown: number, total: number): string {
  const count = new Intl.NumberFormat("en-GB");
  const noun = total === 1 ? "dispute" : "disputes";
  return `${count.format(offset + 1)}–${count.format(offset + shown)} of ${count.format(total)} ${noun}`;
}
