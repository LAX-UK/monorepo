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
  awaiting_shipment: "Awaiting shipment",
  owned: "Owned",
  consigned: "Consigned",
  in_sale: "In a sale",
  sold: "Sold",
  payout_pending: "Payout pending",
  payout_paid: "Payout paid",
};

export type StatusTone = "neutral" | "info" | "success";

/** Only states that need the person, or that are settled, stand out from the neutral rest. */
export const STATUS_TONES: Readonly<Record<LaxPortfolioItemStatus, StatusTone>> = {
  awaiting_payment: "info",
  awaiting_shipment: "info",
  owned: "neutral",
  consigned: "neutral",
  in_sale: "neutral",
  sold: "neutral",
  payout_pending: "info",
  payout_paid: "success",
};

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
