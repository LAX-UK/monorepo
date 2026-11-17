import type { DeliveryQuoteStatus } from "./delivery-quote.js";
import type { FulfilmentFacts } from "./purchase-delivery-stage.js";

/**
 * Where a won lot's delivery stands, as the staff Deliveries list shows it: one status worked out
 * from the courier quote and the lot's fulfilment record, never stored
 * (docs/design/staff-gaps-delivery-zoho-alerts.md, D2). Each status is also a view tab.
 *
 * - `waiting`: the buyer asked for a price and nobody has quoted yet;
 * - `quoted`: a price was sent and the buyer has not accepted it;
 * - `to_dispatch`: the buyer accepted, and the work has not left yet;
 * - `on_the_way`: the courier has it;
 * - `delivered`: it reached the buyer;
 * - `closed`: the buyer withdrew the request, or the sale was cancelled.
 */
export const DELIVERY_STATUSES = [
  "waiting",
  "quoted",
  "to_dispatch",
  "on_the_way",
  "delivered",
  "closed",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** Why a delivery is closed. */
export type DeliveryClosedReason = "withdrawn" | "cancelled";

export type DeliveryStatusFacts = {
  quote: DeliveryQuoteStatus;
  /** The lot's fulfilment record, when one exists yet (it is made at payment). */
  fulfilment: FulfilmentFacts | null;
};

export type DeliveryStatusResult = {
  status: DeliveryStatus;
  /** Set only for `closed`. */
  closedReason: DeliveryClosedReason | null;
  /**
   * An accepted delivery whose lot is not paid yet: the second badge "Awaiting payment" beside
   * "Booked, not dispatched".
   */
  awaitingPayment: boolean;
};

const FROM_QUOTE: Record<Exclude<DeliveryQuoteStatus, "withdrawn">, DeliveryStatus> = {
  requested: "waiting",
  quoted: "quoted",
  accepted: "to_dispatch",
};

/**
 * The one delivery status for a quote and its lot. A withdrawn request is closed whatever the lot
 * did next (the buyer may have collected it instead). Otherwise the fulfilment record wins once
 * the work moves or the sale is cancelled, as it does on the buyer's purchase page, and until
 * then the quote says where things stand.
 *
 * The Deliveries read model filters by the same rule in SQL; its integration test checks the two
 * agree for every combination.
 */
export function deliveryStatusOf(facts: DeliveryStatusFacts): DeliveryStatusResult {
  const { quote, fulfilment } = facts;
  const result = (
    status: DeliveryStatus,
    closedReason: DeliveryClosedReason | null = null,
  ): DeliveryStatusResult => ({
    status,
    closedReason,
    awaitingPayment:
      status === "to_dispatch" && (fulfilment === null || fulfilment.status === "awaiting_payment"),
  });
  if (quote === "withdrawn") return result("closed", "withdrawn");
  if (fulfilment?.status === "cancelled") return result("closed", "cancelled");
  if (fulfilment?.status === "delivered") return result("delivered");
  if (fulfilment?.status === "in_transit") return result("on_the_way");
  return result(FROM_QUOTE[quote]);
}
