import type { AccountPurchaseFacts } from "@/lib/data/http/account-buying.types";
import type { PurchaseDeliveryStage } from "@auction/domain";
import type { StatusBadgeShape, StatusBadgeTone } from "@auction/ui/lax";
import { PURCHASE_STATE_LABEL } from "./purchase-labels";
import type { PurchaseState } from "./purchase-progress";

export type PurchaseBadge = { label: string; tone: StatusBadgeTone; shape: StatusBadgeShape };

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "numeric",
  month: "short",
});

/** How each delivery stage reads on a row: one table, so the list and the page agree. */
export const DELIVERY_STAGE_BADGE: Record<PurchaseDeliveryStage, PurchaseBadge> = {
  awaiting_payment: { label: "Awaiting payment", tone: "neutral", shape: "ring" },
  choose: { label: "Choose delivery", tone: "info", shape: "dot" },
  quote_requested: { label: "Quote requested", tone: "info", shape: "dot" },
  quote_ready: { label: "Quote ready", tone: "warning", shape: "alert" },
  booked: { label: "Booked", tone: "info", shape: "dot" },
  preparing: { label: "Preparing", tone: "info", shape: "dot" },
  ready_to_collect: { label: "Ready to collect", tone: "success", shape: "check" },
  in_transit: { label: "On its way", tone: "info", shape: "dot" },
  delivered: { label: "Delivered", tone: "success", shape: "check" },
  collected: { label: "Collected", tone: "success", shape: "check" },
  cancelled: { label: "Cancelled", tone: "neutral", shape: "ring" },
};

/** The badge for a state when the account's facts are not to hand. */
const STATE_BADGE: Record<PurchaseState, Omit<PurchaseBadge, "label">> = {
  "payment-due": { tone: "warning", shape: "dot" },
  "in-review": { tone: "warning", shape: "alert" },
  "payment-processing": { tone: "info", shape: "dot" },
  "choose-delivery": { tone: "info", shape: "dot" },
  preparing: { tone: "info", shape: "dot" },
  "ready-for-collection": { tone: "success", shape: "check" },
  "in-transit": { tone: "info", shape: "dot" },
  delivered: { tone: "success", shape: "check" },
  collected: { tone: "success", shape: "check" },
  refunded: { tone: "neutral", shape: "ring" },
  cancelled: { tone: "neutral", shape: "ring" },
};

/**
 * Where a purchase stands, as its row says it. Money owed comes first, with its date: an
 * overdue invoice says since when, a due one says by when. After payment the delivery stage
 * speaks (a quote ready to accept asks for attention). Without the account's facts the row
 * falls back to the state read from the payment itself.
 */
export function purchaseBadge(
  state: PurchaseState,
  facts: AccountPurchaseFacts | null,
  informed: boolean,
): PurchaseBadge {
  if (informed && (state === "payment-due" || state === "in-review")) {
    return { label: "Awaiting payment", tone: "neutral", shape: "ring" };
  }
  if (state === "in-review") return { label: PURCHASE_STATE_LABEL[state], ...STATE_BADGE[state] };
  const invoice = facts?.invoice;
  if (invoice?.status === "overdue" && invoice.dueAt) {
    return {
      label: `Overdue since ${DAY_MONTH.format(invoice.dueAt)}`,
      tone: "danger",
      shape: "alert",
    };
  }
  if (invoice?.status === "due" && invoice.dueAt) {
    return { label: `Due ${DAY_MONTH.format(invoice.dueAt)}`, tone: "warning", shape: "dot" };
  }
  if (invoice?.status === "not_invoiced") {
    return { label: "Invoice to follow", tone: "neutral", shape: "ring" };
  }
  const stage = facts?.delivery.stage;
  if (stage && stage !== "awaiting_payment" && state !== "refunded") {
    return DELIVERY_STAGE_BADGE[stage];
  }
  return { label: PURCHASE_STATE_LABEL[state], ...STATE_BADGE[state] };
}
