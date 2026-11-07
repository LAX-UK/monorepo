import type {
  DealBlocker,
  DealListItem,
  DealRecord,
} from "@/lib/data/http/admin-private-sales.schema";
import type { TermKey } from "@/lib/data/http/admin-private-sales.schema";
import type { DealView, PrivateSalePolicyGap } from "@auction/domain";
import { formatStaffDateTime, formatStaffMoney } from "@auction/staff-ui";
import type { PrivateSaleDealStage } from "@auction/types";
import type { StaffDealAction } from "@auction/validators";

/**
 * Words, tones and next steps for the Private sales screens. Every vocabulary is one table keyed
 * by the domain's own union, so adding a stage or a move fails the build here until it has words.
 */

export const DEALS_PATH = "/admin/private-sales";

export function dealHref(reference: string): string {
  return `${DEALS_PATH}/${encodeURIComponent(reference)}`;
}

export const DEAL_STAGE_LABELS = {
  proposed: "Proposed",
  offer: "Offer",
  agreed: "Agreed",
  cleared: "Cleared",
  invoiced: "Invoiced",
  paid: "Paid",
  released: "Released",
  settled: "Settled",
  cancelled: "Cancelled",
} as const satisfies Record<PrivateSaleDealStage, string>;

type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger";
type BadgeShape = "ring" | "dot" | "check" | "alert";

export const DEAL_STAGE_BADGES = {
  proposed: { tone: "neutral", shape: "ring" },
  offer: { tone: "info", shape: "dot" },
  agreed: { tone: "info", shape: "dot" },
  cleared: { tone: "info", shape: "check" },
  invoiced: { tone: "warning", shape: "ring" },
  paid: { tone: "success", shape: "dot" },
  released: { tone: "success", shape: "dot" },
  settled: { tone: "success", shape: "check" },
  cancelled: { tone: "neutral", shape: "check" },
} as const satisfies Record<PrivateSaleDealStage, { tone: BadgeTone; shape: BadgeShape }>;

export const DEAL_VIEW_LABELS = {
  active: "Active",
  needs_me: "Needs me",
  waiting_on_checks: "Waiting on checks",
  payment_due: "Payment due",
  settled: "Settled",
  cancelled: "Cancelled",
  all: "All",
} as const satisfies Record<DealView, string>;

export const DEAL_ORDER_NOTE = {
  active: "Longest waiting first",
  needs_me: "Longest waiting first",
  waiting_on_checks: "Longest waiting first",
  payment_due: "Longest waiting first",
  settled: "Latest first",
  cancelled: "Latest first",
  all: "Latest first",
} as const satisfies Record<DealView, string>;

export const DEAL_EMPTY_COPY = {
  active: {
    title: "No private sales in progress",
    description: "A deal starts when you convert a private sale enquiry.",
  },
  needs_me: {
    title: "Nothing waiting on you",
    description: "Deals you own appear here while they are still open.",
  },
  waiting_on_checks: {
    title: "No deal is waiting on checks",
    description: "Deals appear here once the price is agreed and until both sides are cleared.",
  },
  payment_due: {
    title: "No payment is due",
    description: "Invoiced deals appear here until the buyer has paid.",
  },
  settled: {
    title: "No deal has settled yet",
    description: "A deal settles once the seller's payout is paid.",
  },
  cancelled: {
    title: "No cancelled deals",
    description: "Cancelled deals, with their reasons, appear here.",
  },
  all: {
    title: "No private sales yet",
    description: "A deal starts when you convert a private sale enquiry.",
  },
} as const satisfies Record<DealView, { title: string; description: string }>;

/** What happens next on a deal, in a few words, for the list. */
export function dealNextStep(stage: PrivateSaleDealStage, hasBuyer: boolean): string {
  switch (stage) {
    case "proposed":
      return hasBuyer ? "Record an offer" : "Name the buyer";
    case "offer":
      return "Agree the price";
    case "agreed":
      return "Waiting on checks";
    case "cleared":
      return "Issue the invoice";
    case "invoiced":
      return "Waiting for payment";
    case "paid":
      return "Release the work";
    case "released":
      return "Waiting for the payout";
    case "settled":
      return "Settled";
    case "cancelled":
      return "Cancelled";
  }
}

/** The date this deal is next waiting for, with what it is. */
export function dealDeadline(
  deal: Pick<DealListItem, "offerExpiresAt" | "paymentDueAt" | "collectionDueAt"> & {
    stage: PrivateSaleDealStage;
  },
): { label: string; at: string } | null {
  if (deal.stage === "offer" && deal.offerExpiresAt) {
    return { label: "Offer expires", at: deal.offerExpiresAt };
  }
  if (deal.stage === "invoiced" && deal.paymentDueAt) {
    return { label: "Payment due", at: deal.paymentDueAt };
  }
  if (deal.stage === "paid" && deal.collectionDueAt) {
    return { label: "Collection due", at: deal.collectionDueAt };
  }
  return null;
}

export function describeDeadline(deadline: { label: string; at: string }): string {
  return `${deadline.label} ${formatStaffDateTime(deadline.at)}`;
}

/** What is still to be set up before a real deal can be agreed and invoiced, in plain words. */
export const POLICY_GAP_LABELS = {
  terms_version: "the private sale terms",
  commission_rate: "the commission rate",
  vat_treatments: "the VAT treatments",
  payment_due_days: "the payment deadline",
} as const satisfies Record<PrivateSalePolicyGap, string>;

export function policyGapSentence(gaps: readonly PrivateSalePolicyGap[]): string {
  const names = gaps.map((gap) => POLICY_GAP_LABELS[gap]);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/** The moves, with the effect stated first. The dialog repeats it before anything happens. */
export type DealActionCopy = {
  label: string;
  /** What will happen, in the present tense. */
  effect: (deal: DealRecord) => string;
  confirm: string;
  /** The move asks for a reason, kept with the deal. */
  reason: { label: string; required: boolean; hint: string } | null;
  /** The move takes or returns money: it needs a recent sign-in. */
  money: boolean;
  /** The past tense for the toast. */
  done: string;
};

export const DEAL_ACTION_COPY = {
  open_offer: {
    label: "Open the offer",
    effect: () => "The deal moves to Offer. The price can still be changed until both sides agree.",
    confirm: "Open offer",
    reason: null,
    money: false,
    done: "Offer opened",
  },
  agree: {
    label: "Record the agreement",
    effect: () =>
      "Records that both sides agree the price. The price is then fixed. If both sides are already cleared, the deal clears at once.",
    confirm: "Record agreement",
    reason: null,
    money: false,
    done: "Agreement recorded",
  },
  clear: {
    label: "Check clearance",
    effect: () =>
      "Checks identity, screening and source of funds again. The deal moves to Cleared only if every check is clear. Staff don't decide the checks here.",
    confirm: "Check now",
    reason: null,
    money: false,
    done: "Deal cleared",
  },
  issue_invoice: {
    label: "Issue the invoice",
    effect: () =>
      "The deal moves to Invoiced and the buyer can pay. The terms are then locked. The person who recorded the agreement can't issue the invoice.",
    confirm: "Issue invoice",
    reason: null,
    money: true,
    done: "Invoice issued",
  },
  release: {
    label: "Release the work",
    effect: () =>
      "Records that the work has been collected or shipped. The seller's payout can then be queued.",
    confirm: "Release work",
    reason: null,
    money: false,
    done: "Work released",
  },
  cancel: {
    label: "Cancel the deal",
    effect: (deal) =>
      deal.stage === "paid" || deal.stage === "released"
        ? "Cancels the deal. The buyer must be refunded first."
        : deal.stage === "invoiced"
          ? "Cancels the deal and ends the buyer's open payment, so it can't be paid afterwards."
          : "Cancels the deal. It can't be reopened.",
    confirm: "Cancel deal",
    reason: {
      label: "Reason",
      required: true,
      hint: "Kept with the deal. Don't paste the clients' personal details.",
    },
    money: false,
    done: "Deal cancelled",
  },
  refund: {
    label: "Refund the buyer",
    effect: (deal) =>
      `Returns the whole payment${deal.money ? ` of ${formatStaffMoney(deal.money.totalDueMinor)}` : ""} to the buyer. This can't be undone. Cancel the deal afterwards if it is not going ahead.`,
    confirm: "Refund buyer",
    reason: null,
    money: true,
    done: "Buyer refunded",
  },
} as const satisfies Record<StaffDealAction, DealActionCopy>;

export const TERM_LABELS = {
  priceMinor: "Agreed price",
  buyerFeeBps: "Buyer's fee",
  sellerCommissionBps: "Seller's commission",
  costsMinor: "Agreed costs",
  vatTreatment: "VAT treatment",
  partiesDisclosed: "Parties know each other",
  offerExpiresAt: "Offer expires",
} as const satisfies Record<TermKey, string>;

/** Basis points as a percentage: 1500 is "15%", 250 is "2.5%". */
export function formatBps(bps: number): string {
  const percent = bps / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2).replace(/0$/, "")}%`;
}

/** Every reason a move is off, one sentence each. */
export function blockerMessages(blockers: readonly DealBlocker[]): string[] {
  return blockers.map((b) => b.message);
}

export const CHECK_LABELS = {
  kyc: { clear: "Verified", pending: "Not verified yet", failed: "Not verified" },
  aml: {
    clear: "Clear",
    pending: "Not screened yet",
    review: "With Compliance",
    blocked: "Blocked",
  },
  sourceOfFunds: {
    approved: "Approved",
    pending: "Waiting for review",
    declined: "Declined",
    not_requested: "Not requested",
  },
} as const;
