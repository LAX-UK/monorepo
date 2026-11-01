/**
 * The Disputes screen of Bid admin: what the API sends for the list of dispute cases and for one
 * case, shared by the API, the web app and their tests. Money is in pence; dates are ISO strings.
 */

/** The queues of the screen. `all` lists every case. */
export type DisputeDeskView = "needs_allocation" | "open" | "under_review" | "closed" | "all";

export const DISPUTE_DESK_VIEWS: readonly DisputeDeskView[] = [
  "needs_allocation",
  "open",
  "under_review",
  "closed",
  "all",
];

export type DisputeDeskAllocationState = "allocated" | "needs_allocation";

/** One case as the list shows it. */
export type DisputeDeskCaseSummary = {
  id: string;
  stripeDisputeId: string;
  /** Stripe's dispute status, as last reported. */
  status: string;
  allocationState: DisputeDeskAllocationState;
  /** Waiting for the finance team to allocate it to invoices. */
  awaitingAllocation: boolean;
  amountPence: number;
  currency: string;
  reason: string | null;
  /** The card network's respond-by deadline. */
  dueBy: string | null;
  evidenceSubmitted: boolean;
  openedAt: string;
  closedAt: string | null;
  /** The invoices the charge paid or the case was allocated to. */
  invoiceCount: number;
  /** The lot of the only invoice; null when the case falls on none or several. */
  lotTitle: string | null;
  buyerId: string | null;
  buyerLabel: string | null;
  /** Every seller the invoices belong to, once each. */
  sellerNames: string[];
};

export type DisputeDeskCounts = Record<DisputeDeskView, number>;

export type DisputeDeskPage = {
  rows: DisputeDeskCaseSummary[];
  hasNextPage: boolean;
  /** Cases per view, whatever the search and filters. */
  counts: DisputeDeskCounts;
};

/** An invoice a case can fall on, with what the seller earns from it. */
export type DisputeDeskInvoice = {
  paymentId: string;
  /** A short reference for the invoice, taken from its payment. */
  reference: string;
  lotId: string;
  lotTitle: string;
  sellerId: string;
  sellerName: string;
  invoicePence: number;
  /** The house's fee on the invoice; the rest is the seller's net share. */
  platformFeePence: number;
  paymentStatus: string;
};

export type DisputeDeskClawback = "none" | "withdrawn" | "reversed";

export type DisputeDeskAllocationLine = {
  paymentId: string;
  amountPence: number;
  /** How much of the line comes out of the seller's payout. */
  sellerSharePence: number;
  clawback: DisputeDeskClawback;
  source: "automatic" | "staff" | "legacy";
  allocatedByName: string | null;
  allocatedAt: string;
};

export type DisputeDeskTimelineKind =
  | "opened"
  | "funds_withdrawn"
  | "funds_reinstated"
  | "allocated_automatically"
  | "allocated_by_staff"
  | "closed";

export type DisputeDeskTimelineEntry = {
  id: string;
  kind: DisputeDeskTimelineKind;
  at: string;
  /** Who it happened to or was done by: "Stripe", "Bid", or a staff member's name. */
  actor: string;
  amountPence?: number;
  invoiceCount?: number;
};

export type DisputeDeskCase = DisputeDeskCaseSummary & {
  networkReasonCode: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  /** Stripe's charge ID, to find the dispute in the Stripe dashboard. */
  chargeId: string;
  /** Sent back with an allocation, so a case that moved on in the meantime is refused. */
  version: number;
  fundsWithdrawnAt: string | null;
  fundsReinstatedAt: string | null;
  invoices: DisputeDeskInvoice[];
  allocations: DisputeDeskAllocationLine[];
  timeline: DisputeDeskTimelineEntry[];
};

/** Why an allocation was refused, in the words the screen shows. */
export type DisputeDeskAllocationRefusal =
  | "no_lines"
  | "duplicate_payment"
  | "unknown_payment"
  | "not_a_candidate"
  | "amount_not_positive"
  | "exceeds_invoice"
  | "total_mismatch"
  | "not_found"
  | "already_allocated"
  | "version_conflict";
