import { buildListHref } from "@/lib/admin/admin-list-params";
import { disputeDeadline } from "@auction/domain";
import {
  type FilterOption,
  type DataView as StaffDataView,
  type StatusPresentation,
  formatStaffMoney,
  humanizeStatus,
} from "@auction/staff-ui";
import {
  DISPUTE_DESK_VIEWS,
  type DisputeDeskCaseSummary,
  type DisputeDeskCounts,
  type DisputeDeskView,
} from "@auction/types";

export const DISPUTES_LIST_PATH = "/admin/disputes";

export type DisputesListSearch = Record<string, string | string[] | undefined>;

/** The view a person lands on: the cases waiting for a response. */
export const DEFAULT_DISPUTES_VIEW: DisputeDeskView = "open";

/** Stripe's reasons, in the words finance uses. A reason Stripe adds later shows humanised. */
const REASON_LABELS: Readonly<Record<string, string>> = {
  fraudulent: "Fraudulent",
  duplicate: "Duplicate charge",
  product_not_received: "Product not received",
  product_unacceptable: "Product unacceptable",
  subscription_canceled: "Subscription cancelled",
  unrecognized: "Unrecognised",
  credit_not_processed: "Credit not processed",
  general: "General",
  bank_cannot_process: "Bank cannot process",
  debit_not_authorized: "Debit not authorised",
  incorrect_account_details: "Incorrect account details",
  insufficient_funds: "Insufficient funds",
};

export function disputeReasonLabel(reason: string | null): string {
  if (!reason) return "Reason not given";
  return REASON_LABELS[reason] ?? humanizeStatus(reason);
}

/** The reasons offered as a filter. */
export const DISPUTE_REASON_FILTERS: readonly FilterOption[] = Object.entries(REASON_LABELS).map(
  ([value, label]) => ({ value, label }),
);

/** How each Stripe status reads on the screen; a status not listed shows humanised and neutral. */
const STATUS_PRESENTATION: Readonly<Record<string, StatusPresentation>> = {
  needs_response: { label: "Needs response", tone: "warning" },
  warning_needs_response: { label: "Early warning", tone: "warning" },
  under_review: { label: "Under review", tone: "info" },
  warning_under_review: { label: "Early warning under review", tone: "info" },
  won: { label: "Won", tone: "success" },
  lost: { label: "Lost", tone: "danger" },
  warning_closed: { label: "Early warning closed", tone: "neutral" },
  prevented: { label: "Prevented", tone: "neutral" },
  charge_refunded: { label: "Refunded", tone: "neutral" },
};

export function disputeStatusPresentation(status: string): StatusPresentation {
  return STATUS_PRESENTATION[status] ?? { label: humanizeStatus(status), tone: "neutral" };
}

/** Where a case stands on allocation, as a badge. */
export function disputeAllocationPresentation(
  row: Pick<DisputeDeskCaseSummary, "awaitingAllocation" | "allocationState" | "invoiceCount">,
): StatusPresentation {
  if (row.awaitingAllocation) {
    return row.invoiceCount === 0
      ? { label: "No payment found", tone: "danger" }
      : { label: "Needs allocation", tone: "warning" };
  }
  if (row.allocationState === "allocated") return { label: "Allocated", tone: "success" };
  return { label: "Not needed", tone: "neutral" };
}

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/London",
});

export type DisputeDeadlinePresentation = {
  /** The respond-by sentence: "2 days left", "Respond by 12 Nov", "Evidence submitted". */
  label: string;
  /** A badge tone when the date is close; null for plain text. */
  tone: StatusPresentation["tone"] | null;
};

/** The respond-by date as text, with a badge when it is within a week. Never colour alone. */
export function disputeDeadlinePresentation(
  row: Pick<DisputeDeskCaseSummary, "dueBy" | "status" | "evidenceSubmitted">,
  now: Date,
): DisputeDeadlinePresentation | null {
  const deadline = disputeDeadline(
    {
      dueBy: row.dueBy ? new Date(row.dueBy) : null,
      status: row.status,
      evidenceSubmitted: row.evidenceSubmitted,
    },
    now,
  );
  const due = row.dueBy ? DAY_MONTH.format(new Date(row.dueBy)) : "";
  switch (deadline.state) {
    case "none":
      return null;
    case "submitted":
      return { label: "Evidence submitted", tone: null };
    case "overdue":
      return { label: `Overdue since ${due}`, tone: "danger" };
    case "urgent":
    case "soon": {
      const days = deadline.daysLeft ?? 0;
      return {
        label: days === 1 ? "1 day left" : `${days} days left`,
        tone: deadline.state === "urgent" ? "danger" : "warning",
      };
    }
    default:
      return { label: `Respond by ${due}`, tone: null };
  }
}

/** What a row's first cell says about the invoices behind the case. */
export function disputeTitle(
  row: Pick<DisputeDeskCaseSummary, "invoiceCount" | "lotTitle">,
): string {
  if (row.invoiceCount === 0) return "No matching payment";
  if (row.invoiceCount === 1) return row.lotTitle ?? "One invoice";
  return `${row.invoiceCount} lots on one payment`;
}

/** One dispute case as the staff list shows it; plain data, so it crosses to the client as is. */
export type DisputesStaffRow = {
  id: string;
  stripeDisputeId: string;
  title: string;
  kind: "single" | "shared" | "unmatched";
  reason: string;
  allocation: StatusPresentation;
  deadline: DisputeDeadlinePresentation | null;
  /** The respond-by instant, for sorting; null when there is no deadline to sort by. */
  dueBy: string | null;
  buyerId: string | null;
  buyer: string | null;
  amount: string;
  amountPence: number;
  status: StatusPresentation;
  openedAt: string;
};

export function toDisputesStaffRows(
  rows: readonly DisputeDeskCaseSummary[],
  now: Date,
): DisputesStaffRow[] {
  return rows.map((row) => ({
    id: row.id,
    stripeDisputeId: row.stripeDisputeId,
    title: disputeTitle(row),
    kind: row.invoiceCount === 0 ? "unmatched" : row.invoiceCount === 1 ? "single" : "shared",
    reason: disputeReasonLabel(row.reason),
    allocation: disputeAllocationPresentation(row),
    deadline: disputeDeadlinePresentation(row, now),
    dueBy: row.dueBy,
    buyerId: row.buyerId,
    buyer: row.buyerId ? row.buyerLabel?.trim() || "Buyer" : null,
    amount: formatStaffMoney(row.amountPence, row.currency),
    amountPence: row.amountPence,
    status: disputeStatusPresentation(row.status),
    openedAt: row.openedAt,
  }));
}

/** A link to the list with some of its URL state changed; paging restarts. */
export function disputesListHref(
  search: DisputesListSearch,
  patch: Record<string, string | number | null | undefined>,
): string {
  const base: DisputesListSearch = { ...search };
  for (const key of ["error", "success"]) delete base[key];
  return buildListHref(DISPUTES_LIST_PATH, base, {
    ...("offset" in patch ? {} : { offset: null }),
    ...patch,
  });
}

export function activeDisputesView(search: DisputesListSearch): DisputeDeskView {
  const view = typeof search.view === "string" ? search.view : "";
  return (DISPUTE_DESK_VIEWS as readonly string[]).includes(view)
    ? (view as DisputeDeskView)
    : DEFAULT_DISPUTES_VIEW;
}

const VIEW_LABELS: Readonly<Record<DisputeDeskView, string>> = {
  needs_allocation: "Needs allocation",
  open: "Open",
  under_review: "Under review",
  closed: "Closed",
  all: "All",
};

/** Views whose cases are work waiting, so only they carry a count. */
const COUNTED_VIEWS: readonly DisputeDeskView[] = ["needs_allocation", "open"];

/** The queues as tabs. The default view's link leaves the URL clean. */
export function disputesViews(
  search: DisputesListSearch,
  counts: DisputeDeskCounts,
): StaffDataView[] {
  return DISPUTE_DESK_VIEWS.map((view) => ({
    id: view,
    label: VIEW_LABELS[view],
    href: disputesListHref(search, { view: view === DEFAULT_DISPUTES_VIEW ? null : view }),
    ...(COUNTED_VIEWS.includes(view) && counts[view] > 0 ? { count: counts[view] } : {}),
  }));
}

export type DisputesFilterChip = { id: string; label: string; clearHref: string };

export function disputesFilterChips(search: DisputesListSearch): DisputesFilterChip[] {
  const reason = typeof search.reason === "string" ? search.reason : "";
  if (!reason) return [];
  return [
    {
      id: "reason",
      label: `Reason: ${disputeReasonLabel(reason)}`,
      clearHref: disputesListHref(search, { reason: null }),
    },
  ];
}

/** What an empty view says, so a quiet queue reads as good news and not as a fault. */
export const EMPTY_VIEW_COPY: Readonly<
  Record<DisputeDeskView, { title: string; description: string }>
> = {
  needs_allocation: {
    title: "Nothing needs allocating",
    description:
      "When a card dispute falls on a payment that settled several invoices, or on none, it waits here for you to allocate it.",
  },
  open: {
    title: "No open disputes",
    description: "When a buyer challenges a card payment, the case appears here with its deadline.",
  },
  under_review: {
    title: "No disputes under review",
    description: "Cases the card network is deciding appear here once evidence is submitted.",
  },
  closed: {
    title: "No closed disputes",
    description: "Won, lost and closed disputes are kept here.",
  },
  all: {
    title: "No disputes yet",
    description: "When a buyer challenges a card payment, the case appears here with its deadline.",
  },
};

/** "1–50 of 312 disputes". */
export function disputesRangeSummary(offset: number, shown: number, total: number): string {
  const count = new Intl.NumberFormat("en-GB");
  const noun = total === 1 ? "dispute" : "disputes";
  return `${count.format(offset + 1)}–${count.format(offset + shown)} of ${count.format(total)} ${noun}`;
}
