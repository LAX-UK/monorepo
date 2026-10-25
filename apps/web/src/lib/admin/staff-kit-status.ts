import type { StatusBadgeVariant } from "@/lib/presenters/status-presentation";
import { resolveStatusPresentation } from "@/lib/presenters/status-presentation";
import type { LotStatusContext, StatusDomain } from "@/lib/presenters/status/core";
import { type StatusPresentation, humanizeStatus } from "@auction/staff-ui";

/**
 * Bid's status registries (lib/presenters/status) speak in badge variants; the staff kit speaks
 * in tones. "live" is the danger tone with a pulsing dot, so live lots and sales still read as
 * happening now. One adapter keeps the registries the single source of each label and tone.
 */
export function toStaffStatus(variant: StatusBadgeVariant, label: string): StatusPresentation {
  if (variant === "live") return { label, tone: "danger", live: true };
  return { label, tone: variant };
}

type CatalogueDomain = "lot" | "sale" | "submission" | "conditionReport" | "onsiteEvent";

/**
 * The catalogue families as staff read them. The shared registry gives drafts and scheduled
 * records the same tone; on a staff list a draft is not yet anything (neutral) and a scheduled
 * record is on its way (info), so the two never look alike. A lot that was taken out of its sale
 * reads "Withdrawn", the word staff use for the action, and a declined condition report is a
 * closed outcome rather than a failure.
 */
const CATALOGUE_STATUS: Record<CatalogueDomain, Record<string, StatusPresentation>> = {
  lot: {
    draft: { label: "Draft", tone: "neutral" },
    scheduled: { label: "Scheduled", tone: "info" },
    active: { label: "Live", tone: "danger", live: true },
    ended: { label: "Ended", tone: "neutral" },
    cancelled: { label: "Withdrawn", tone: "danger" },
    voided: { label: "Voided", tone: "danger" },
  },
  sale: {
    draft: { label: "Draft", tone: "neutral" },
    scheduled: { label: "Scheduled", tone: "info" },
    active: { label: "Live", tone: "danger", live: true },
    ended: { label: "Ended", tone: "neutral" },
    cancelled: { label: "Cancelled", tone: "danger" },
  },
  submission: {
    draft: { label: "Draft", tone: "neutral" },
    submitted: { label: "Submitted", tone: "info" },
    under_review: { label: "Under review", tone: "warning" },
    approved: { label: "Approved", tone: "success" },
    converted: { label: "Converted to lot", tone: "success" },
    rejected: { label: "Rejected", tone: "danger" },
    withdrawn: { label: "Withdrawn", tone: "neutral" },
  },
  conditionReport: {
    requested: { label: "Requested", tone: "warning" },
    pending: { label: "Requested", tone: "warning" },
    in_progress: { label: "In progress", tone: "info" },
    fulfilled: { label: "Fulfilled", tone: "success" },
    declined: { label: "Declined", tone: "neutral" },
  },
  onsiteEvent: {
    draft: { label: "Draft", tone: "neutral" },
    published: { label: "Published", tone: "success" },
    closed: { label: "RSVPs closed", tone: "neutral" },
    cancelled: { label: "Cancelled", tone: "danger" },
  },
};

function isCatalogueDomain(domain: StatusDomain): domain is CatalogueDomain {
  return domain in CATALOGUE_STATUS;
}

export type StaffStatusContext = {
  /** For an ended lot: whether it sold, so the badge reads Sold or Unsold instead of Ended. */
  lot?: LotStatusContext;
};

/**
 * Every Bid status family on the kit's five tones (neutral, info, success, warning, danger), from
 * the one registry, so a payment, payout, dispute, AML or source-of-funds status looks the same
 * on every page and in both staff tools. The catalogue families (lot, sale, submission and
 * condition report) use the staff table above. A status nobody knows yet still renders, as its
 * name in sentence case in the neutral tone.
 */
export function staffStatus(
  domain: StatusDomain,
  status: string,
  context?: StaffStatusContext,
): StatusPresentation {
  if (isCatalogueDomain(domain)) {
    if (domain === "lot" && status === "ended") return endedLotStatus(context?.lot);
    return CATALOGUE_STATUS[domain][status] ?? { label: humanizeStatus(status), tone: "neutral" };
  }
  const presentation = resolveStatusPresentation(domain, status);
  // The registry falls back to the raw value ("pending_refund_period" or "pending refund period").
  const raw = /^[a-z]/.test(presentation.label) || presentation.label.includes("_");
  const label = raw ? humanizeStatus(status) : presentation.label;
  return toStaffStatus(presentation.variant, label);
}

/** Sold when the lot has a winner, Unsold when it closed without one, Ended when not known. */
function endedLotStatus(context: LotStatusContext | undefined): StatusPresentation {
  const winner = context?.winnerId;
  if (winner != null || context?.hasWinner === true) return { label: "Sold", tone: "success" };
  if (winner === null || context?.hasWinner === false) return { label: "Unsold", tone: "neutral" };
  return { label: "Ended", tone: "neutral" };
}

/** A guest on an event's list: arrived at the door, or still expected. */
export function staffArrivalStatus(arrived: boolean): StatusPresentation {
  return arrived
    ? { label: "Arrived", tone: "success" }
    : { label: "Not arrived", tone: "neutral" };
}
