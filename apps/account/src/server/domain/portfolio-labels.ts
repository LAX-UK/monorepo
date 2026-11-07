import type {
  LaxCostLineKind,
  LaxDocumentKind,
  LaxMoneyStatus,
  LaxPortfolioActionKind,
  LaxPortfolioItemStatus,
  LaxProductId,
  MoneySectionKey,
} from "@auction/lax-ecosystem";

/** The product names a person knows, as they appear on a badge or in a sentence. */
export const PRODUCT_LABELS: Readonly<Record<LaxProductId, string>> = {
  bid: "LAX Bid",
  shop: "LAX Shop",
  art: "lax.art",
};

export const STATUS_LABELS: Readonly<Record<LaxPortfolioItemStatus, string>> = {
  awaiting_payment: "Awaiting payment",
  payment_confirming: "Payment being confirmed",
  awaiting_shipment: "Awaiting shipment",
  owned: "Owned",
  consigned: "Consigned",
  in_sale: "In a sale",
  sold: "Sold",
  payout_pending: "Payout pending",
  payout_paid: "Payout paid",
};

/**
 * Tones come from the shared status kit, and only three are used: warning marks what the person
 * must act on, info marks work in progress, neutral marks everything settled or inactive. Never
 * green and never the product accent, so the one amber badge on a page is the one that needs them.
 */
export type StatusTone = "neutral" | "info" | "warning";

/** The cue drawn before the label, so a status never relies on its colour alone. */
export type StatusCue = "ring" | "dot" | "check" | "alert";

export type StatusStyle = { tone: StatusTone; cue: StatusCue };

const NEEDS_YOU: StatusStyle = { tone: "warning", cue: "alert" };
const IN_PROGRESS: StatusStyle = { tone: "info", cue: "dot" };
const SETTLED: StatusStyle = { tone: "neutral", cue: "check" };
const CLOSED: StatusStyle = { tone: "neutral", cue: "ring" };

export const STATUS_STYLES: Readonly<Record<LaxPortfolioItemStatus, StatusStyle>> = {
  awaiting_payment: NEEDS_YOU,
  payment_confirming: IN_PROGRESS,
  awaiting_shipment: IN_PROGRESS,
  owned: SETTLED,
  consigned: IN_PROGRESS,
  in_sale: IN_PROGRESS,
  sold: SETTLED,
  payout_pending: IN_PROGRESS,
  payout_paid: SETTLED,
};

/**
 * How a money line reads. A pending line you owe needs you; any other pending line is on its
 * way; a completed line is settled; a cancelled line is closed and counts for nothing.
 */
export function moneyStatusStyle(status: LaxMoneyStatus, section: MoneySectionKey): StatusStyle {
  switch (status) {
    case "pending":
      return section === "owed_by_you" ? NEEDS_YOU : IN_PROGRESS;
    case "completed":
      return SETTLED;
    case "cancelled":
      return CLOSED;
  }
}

export const COST_LINE_LABELS: Readonly<Record<LaxCostLineKind, string>> = {
  hammer: "Hammer price",
  premium: "Buyer's premium",
  vat: "VAT",
  fees: "Fees",
  shipping: "Shipping",
  price: "Price",
};

export const DOCUMENT_LABELS: Readonly<Record<LaxDocumentKind, string>> = {
  invoice: "Invoice",
  payout_statement: "Payout statement",
  certificate: "Certificate of authenticity",
  provenance: "Provenance",
  condition_report: "Condition report",
  insurance_schedule: "Insurance schedule",
};

export const ACTION_LABELS: Readonly<Record<LaxPortfolioActionKind, string>> = {
  pay: "Pay now",
  track_shipping: "Track shipping",
  consign: "Consign this work",
  resell: "Resell this work",
  contact: "Contact",
  view: "View",
};

export const MONEY_SECTION_LABELS: Readonly<Record<MoneySectionKey, string>> = {
  owed_by_you: "Owed by you",
  due_to_you: "Due to you",
  received: "Received",
  paid: "Paid",
  refunded: "Refunded",
  fee: "Fees",
};

export const MONEY_STATUS_LABELS: Readonly<Record<LaxMoneyStatus, string>> = {
  pending: "Pending",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** How soon a tone asks for the person: lower comes first. */
const TONE_URGENCY: Readonly<Record<StatusTone, number>> = { warning: 0, info: 1, neutral: 2 };

/**
 * The status among several that asks the most of the person, judged by its tone: what they must
 * act on, then what is in progress, then what is settled. Of statuses with the same tone the
 * first given wins, which does not matter to a pill that takes only the tone and cue.
 */
export function mostUrgentStatus(
  statuses: readonly [LaxPortfolioItemStatus, ...LaxPortfolioItemStatus[]],
): LaxPortfolioItemStatus {
  return statuses.reduce((urgent, status) =>
    TONE_URGENCY[STATUS_STYLES[status].tone] < TONE_URGENCY[STATUS_STYLES[urgent].tone]
      ? status
      : urgent,
  );
}
