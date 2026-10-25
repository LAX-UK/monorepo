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
  if (domain === "kyc") return staffIdentityStatus(status);
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

const IDENTITY_STATUS: Record<string, StatusPresentation> = {
  approved: { label: "Verified", tone: "success" },
  pending: { label: "Submitted", tone: "warning" },
  submitted: { label: "Submitted", tone: "warning" },
  under_review: { label: "In review", tone: "warning" },
  rejected: { label: "Rejected", tone: "danger" },
  expired: { label: "Expired", tone: "warning" },
  unverified: { label: "Not verified", tone: "neutral" },
};

/**
 * A person's identity check as staff read it. Someone who never started one is "Not verified",
 * never the stored value "unverified".
 */
export function staffIdentityStatus(status: string | null | undefined): StatusPresentation {
  if (!status || status === "unknown") return { label: "Not verified", tone: "neutral" };
  return IDENTITY_STATUS[status] ?? { label: humanizeStatus(status), tone: "neutral" };
}

const IDENTITY_SESSION_STATUS: Record<string, StatusPresentation> = {
  approved: { label: "Approved", tone: "success" },
  declined: { label: "Declined", tone: "danger" },
  resubmission_requested: { label: "Resubmission requested", tone: "warning" },
  review: { label: "In review", tone: "warning" },
  expired: { label: "Expired", tone: "neutral" },
  abandoned: { label: "Abandoned", tone: "neutral" },
  created: { label: "Started", tone: "info" },
  started: { label: "Started", tone: "info" },
  submitted: { label: "Submitted", tone: "info" },
};

/** One identity check (a verification session) with the provider, as staff read its outcome. */
export function staffIdentitySessionStatus(status: string): StatusPresentation {
  return IDENTITY_SESSION_STATUS[status] ?? { label: humanizeStatus(status), tone: "neutral" };
}

/** A guest on an event's list: arrived at the door, or still expected. */
export function staffArrivalStatus(arrived: boolean): StatusPresentation {
  return arrived
    ? { label: "Arrived", tone: "success" }
    : { label: "Not arrived", tone: "neutral" };
}

const TELEPHONE_BOOKING_STATUS: Record<string, StatusPresentation> = {
  requested: { label: "Requested", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "info" },
  in_progress: { label: "In progress", tone: "info", live: true },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

/** A telephone bidding line: asked for, confirmed, being worked now, finished or cancelled. */
export function staffTelephoneBookingStatus(status: string): StatusPresentation {
  return TELEPHONE_BOOKING_STATUS[status] ?? { label: humanizeStatus(status), tone: "neutral" };
}

const ATG_AUCTION_STATUS: Record<string, StatusPresentation> = {
  pending: { label: "Pending", tone: "neutral" },
  created: { label: "On ATG as a draft", tone: "info" },
  approved: { label: "Approved", tone: "info" },
  published: { label: "Published", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
};

/** A sale's auction on the ATG White Label; null when it has not been pushed. */
export function staffAtgAuctionStatus(status: string | null | undefined): StatusPresentation {
  if (!status) return { label: "Not on ATG", tone: "neutral" };
  return ATG_AUCTION_STATUS[status] ?? { label: humanizeStatus(status), tone: "neutral" };
}

/** One lot's state on ATG, from the fields the sync records. */
export function staffAtgLotStatus(lot: {
  atgLotId: string | null;
  lastError: string | null;
  sold: boolean | null;
  numberOfBids: number | null;
}): StatusPresentation {
  if (lot.lastError) return { label: "Sync error", tone: "danger" };
  if (!lot.atgLotId) return { label: "Not pushed", tone: "neutral" };
  if (lot.sold) return { label: "Sold", tone: "success" };
  const bids = lot.numberOfBids ?? 0;
  if (bids > 0) return { label: bids === 1 ? "1 bid" : `${bids} bids`, tone: "info" };
  return { label: "On ATG", tone: "info" };
}
