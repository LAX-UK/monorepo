import {
  disputeAllocationPresentation,
  disputeDeadlinePresentation,
  disputeReasonLabel,
  disputeStatusPresentation,
} from "@/lib/admin/finance/disputes-staff-list.vm";
import { disputeDeadline, disputeStatusView } from "@auction/domain";
import { type StatusPresentation, type TimelineEvent, formatStaffMoney } from "@auction/staff-ui";
import type {
  DisputeDeskAllocationLine,
  DisputeDeskCase,
  DisputeDeskInvoice,
  DisputeDeskTimelineEntry,
} from "@auction/types";

/** What the allocation section can do for this case. */
export type DisputeAllocationMode =
  /** The finance team allocates it: the invoices are known and nothing is saved yet. */
  | "allocate"
  /** Nothing matched the charge, so there is no invoice to allocate to. */
  | "unmatched"
  /** Already allocated, by Bid or by finance. */
  | "allocated"
  /** The case ended without a loss, so no payout moves and nothing needs allocating. */
  | "not_needed";

export function disputeAllocationMode(
  row: Pick<DisputeDeskCase, "awaitingAllocation" | "allocationState" | "invoiceCount">,
): DisputeAllocationMode {
  if (row.awaitingAllocation) return row.invoiceCount === 0 ? "unmatched" : "allocate";
  return row.allocationState === "allocated" ? "allocated" : "not_needed";
}

const TIMELINE_TITLES: Record<
  DisputeDeskTimelineEntry["kind"],
  (entry: DisputeDeskTimelineEntry, currency: string) => string
> = {
  opened: () => "Dispute opened by the card network",
  funds_withdrawn: (entry, currency) =>
    `Funds withdrawn: ${formatStaffMoney(entry.amountPence ?? 0, currency)}`,
  funds_reinstated: (entry, currency) =>
    `Funds returned: ${formatStaffMoney(entry.amountPence ?? 0, currency)}`,
  allocated_automatically: () => "Matched to the invoice on the charge",
  allocated_by_staff: (entry) =>
    `Allocated to ${entry.invoiceCount === 1 ? "1 invoice" : `${entry.invoiceCount ?? 0} invoices`}`,
  closed: () => "Dispute closed",
};

const TIMELINE_TONES: Partial<Record<DisputeDeskTimelineEntry["kind"], TimelineEvent["tone"]>> = {
  opened: "warning",
  closed: "neutral",
  funds_reinstated: "success",
};

export function disputeTimelineEvents(
  entries: readonly DisputeDeskTimelineEntry[],
  currency: string,
  status: string,
): TimelineEvent[] {
  return entries.map((entry) => {
    const title =
      entry.kind === "closed"
        ? `Dispute ${disputeStatusPresentation(status).label.toLowerCase()}`
        : TIMELINE_TITLES[entry.kind](entry, currency);
    const tone = TIMELINE_TONES[entry.kind];
    return {
      id: entry.id,
      title,
      at: entry.at,
      actor: entry.actor,
      ...(tone ? { tone } : {}),
    };
  });
}

export type DisputeCaseHeader = {
  title: string;
  status: StatusPresentation;
  allocation: StatusPresentation;
  /** The mobile page title, never a generic "Detail". */
  documentTitle: string;
};

export function disputeCaseHeader(found: DisputeDeskCase): DisputeCaseHeader {
  const amount = formatStaffMoney(found.amountPence, found.currency);
  const title = `${amount} · ${disputeReasonLabel(found.reason)}`;
  return {
    title,
    status: disputeStatusPresentation(found.status),
    allocation: disputeAllocationPresentation(found),
    documentTitle: title,
  };
}

/** The side-column deadline block: how long is left, and the plain date and time. */
export type DisputeDeadlineBlock = {
  headline: string;
  tone: StatusPresentation["tone"] | null;
  /** "Respond by 6 Nov 2026, 23:59 GMT", or null once the case is closed. */
  detail: string | null;
};

export function disputeDeadlineBlock(
  found: Pick<DisputeDeskCase, "dueBy" | "status" | "evidenceSubmitted">,
  now: Date,
  formatDateTime: (value: string) => string,
): DisputeDeadlineBlock {
  const presentation = disputeDeadlinePresentation(found, now);
  const deadline = disputeDeadline(
    {
      dueBy: found.dueBy ? new Date(found.dueBy) : null,
      status: found.status,
      evidenceSubmitted: found.evidenceSubmitted,
    },
    now,
  );
  if (!presentation || !found.dueBy) {
    return {
      headline: disputeStatusView(found.status) === "closed" ? "Closed" : "No deadline set",
      tone: null,
      detail: null,
    };
  }
  // A far deadline reads "Respond by 12 Nov" in the list; here the days left come first.
  const headline = deadline.state === "ok" ? `${deadline.daysLeft} days left` : presentation.label;
  return {
    headline,
    tone: presentation.tone,
    detail: `Respond by ${formatDateTime(found.dueBy)}`,
  };
}

/** One invoice with the share the case put on it. */
export type DisputeInvoiceRow = {
  invoice: DisputeDeskInvoice;
  line: DisputeDeskAllocationLine | null;
};

export function disputeInvoiceRows(found: DisputeDeskCase): DisputeInvoiceRow[] {
  const lineByPayment = new Map(found.allocations.map((line) => [line.paymentId, line] as const));
  return found.invoices.map((invoice) => ({
    invoice,
    line: lineByPayment.get(invoice.paymentId) ?? null,
  }));
}
