import { type StatusPresentation, humanizeStatus } from "@auction/staff-ui";
import { ORDER_STATUS_LABELS, orderStatusTone } from "./order-list.vm";

/*
 * Every LAX Admin status on the kit's five tones, in one table, so a payout, a hold or a
 * production task reads the same wherever it appears: list, record panel, record page and
 * confirm. A status nobody has mapped yet still renders, as its name in sentence case in the
 * neutral tone, never as the raw value.
 *
 * Tones: neutral for not started or finished without a result, info for in progress, warning for
 * waiting on staff, success for done, danger for failed or lost.
 */

export type LaxStatusDomain =
  | "order"
  | "fulfilment"
  | "refund"
  | "payout"
  | "hold"
  | "thirdPartySale"
  | "fee"
  | "originalSale"
  | "production"
  | "dispute"
  | "saleRequest"
  | "artwork"
  | "artist"
  | "edition"
  | "merchandise"
  | "editorial"
  | "help"
  | "enquiry"
  | "artistApplication"
  | "staffAccess"
  | "custody";

const ORDER = Object.fromEntries(
  Object.entries(ORDER_STATUS_LABELS).map(([status, label]) => [
    status,
    { label, tone: orderStatusTone(status) },
  ]),
) as Record<string, StatusPresentation>;

const LAX_STATUS: Record<LaxStatusDomain, Readonly<Record<string, StatusPresentation>>> = {
  order: ORDER,
  fulfilment: {
    pending_production: { label: "Waiting for production", tone: "neutral" },
    in_production: { label: "In production", tone: "info" },
    awaiting_dispatch: { label: "Ready to dispatch", tone: "warning" },
    in_transit: { label: "In transit", tone: "info" },
    ready_for_collection: { label: "Ready for collection", tone: "warning" },
    collected: { label: "Collected", tone: "success" },
    in_storage: { label: "In storage", tone: "neutral" },
    delivered: { label: "Delivered", tone: "success" },
    cancelled: { label: "Cancelled", tone: "neutral" },
  },
  refund: {
    pending: { label: "Pending", tone: "warning" },
    succeeded: { label: "Refunded", tone: "success" },
    failed: { label: "Failed", tone: "danger" },
    cancelled: { label: "Cancelled", tone: "neutral" },
  },
  payout: {
    pending_refund_period: { label: "Waiting for refund period", tone: "neutral" },
    due: { label: "Due", tone: "warning" },
    paid: { label: "Paid", tone: "success" },
    cancelled: { label: "Cancelled", tone: "neutral" },
  },
  hold: {
    active: { label: "Active", tone: "success" },
    released: { label: "Released", tone: "neutral" },
    expired: { label: "Expired", tone: "neutral" },
    converted: { label: "Sold", tone: "info" },
  },
  thirdPartySale: {
    draft: { label: "Draft", tone: "neutral" },
    recorded: { label: "Recorded", tone: "success" },
    cancelled: { label: "Cancelled", tone: "neutral" },
  },
  fee: {
    pending: { label: "Awaiting approval", tone: "warning" },
    approved: { label: "Approved", tone: "success" },
    rejected: { label: "Rejected", tone: "danger" },
  },
  originalSale: {
    reserved: { label: "Reserved", tone: "info" },
    deposit_due: { label: "Deposit due", tone: "warning" },
    invoiced: { label: "Invoiced", tone: "warning" },
    paid: { label: "Paid", tone: "success" },
    assigned: { label: "Assigned", tone: "success" },
    cancelled: { label: "Cancelled", tone: "neutral" },
  },
  production: {
    queued: { label: "Queued", tone: "neutral" },
    printing: { label: "Printing", tone: "info" },
    qc_pending: { label: "Awaiting quality check", tone: "info" },
    qc_failed: { label: "Quality check failed", tone: "danger" },
    qc_passed: { label: "Quality check passed", tone: "success" },
    completed: { label: "Completed", tone: "success" },
    cancelled: { label: "Cancelled", tone: "neutral" },
  },
  dispute: {
    opened: { label: "Open", tone: "warning" },
    won: { label: "Won", tone: "success" },
    lost: { label: "Lost", tone: "danger" },
    closed: { label: "Closed", tone: "neutral" },
  },
  saleRequest: {
    pending: { label: "Waiting for review", tone: "warning" },
    approved: { label: "Approved", tone: "success" },
    rejected: { label: "Declined", tone: "neutral" },
    cancelled: { label: "Withdrawn", tone: "neutral" },
  },
  artwork: {
    live: { label: "Live", tone: "success", shape: "dot" },
    draft: { label: "Draft", tone: "info" },
    sold_out: { label: "Sold out", tone: "warning" },
    archived: { label: "Archived", tone: "neutral" },
  },
  artist: {
    active: { label: "Active", tone: "success" },
    archived: { label: "Archived", tone: "neutral" },
  },
  edition: {
    not_authorised: { label: "Not for sale", tone: "neutral" },
    authorised: { label: "For sale", tone: "success" },
    reserved: { label: "Reserved", tone: "info" },
    held: { label: "On hold", tone: "warning" },
    sold: { label: "Sold", tone: "neutral" },
    withdrawn: { label: "Withdrawn", tone: "neutral" },
  },
  merchandise: {
    active: { label: "On sale", tone: "success" },
    archived: { label: "Archived", tone: "neutral" },
  },
  editorial: {
    draft: { label: "Draft", tone: "info" },
    published: { label: "Published", tone: "success" },
  },
  help: {
    draft: { label: "Draft", tone: "info" },
    published: { label: "Published", tone: "success" },
  },
  staffAccess: {
    active: { label: "Active", tone: "success" },
    disabled: { label: "Access removed", tone: "neutral" },
  },
  custody: {
    unprinted: { label: "Not printed yet", tone: "neutral" },
    in_production: { label: "In production", tone: "info" },
    qc_failed: { label: "Failed quality check", tone: "danger" },
    stored: { label: "In LAX storage", tone: "neutral" },
    in_transit: { label: "In transit", tone: "info" },
    delivered: { label: "Delivered", tone: "success" },
    collected: { label: "Collected", tone: "success" },
    with_owner: { label: "With the owner", tone: "success" },
    returned: { label: "Returned", tone: "neutral" },
  },
  enquiry: {
    new: { label: "New", tone: "warning" },
    in_progress: { label: "In progress", tone: "info" },
    closed: { label: "Closed", tone: "neutral" },
  },
  artistApplication: {
    draft: { label: "Draft", tone: "neutral" },
    submitted: { label: "New", tone: "warning" },
    in_review: { label: "In review", tone: "info" },
    more_info_needed: { label: "Waiting on artist", tone: "info" },
    accepted: { label: "Accepted", tone: "success" },
    declined: { label: "Declined", tone: "neutral" },
  },
};

/** A status as staff read it: its label and tone. */
export function staffStatus(domain: LaxStatusDomain, status: string): StatusPresentation {
  return LAX_STATUS[domain][status] ?? { label: humanizeStatus(status), tone: "neutral" };
}

/** The presenter for one domain, for `MappedStatusBadge present={…}`. */
export function presentStatus(domain: LaxStatusDomain): (status: string) => StatusPresentation {
  return (status) => staffStatus(domain, status);
}

/** The label alone, e.g. for a view tab or a filter option. */
export function staffStatusLabel(domain: LaxStatusDomain, status: string): string {
  return staffStatus(domain, status).label;
}
