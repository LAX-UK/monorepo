import type { DeliveryQuoteStatus } from "./delivery-quote.js";
import { type FulfilmentFacts, purchaseDeliveryStage } from "./purchase-delivery-stage.js";
import type { PurchaseInvoiceStatus } from "./purchase-invoice-state.js";

/**
 * Where a won lot's delivery stands, as the staff Deliveries list shows it: one status worked out
 * from the courier quote and the lot's fulfilment record, never stored
 * (docs/design/staff-gaps-delivery-zoho-alerts.md, D2). Each status is also a view tab.
 *
 * - `waiting`: the buyer asked for a price and nobody has quoted yet;
 * - `quoted`: a price was sent and the buyer has not accepted it;
 * - `to_dispatch`: the buyer accepted, and the work has not left yet;
 * - `on_the_way`: the courier has it (a shipping fulfilment in transit);
 * - `delivered`: the courier delivered it;
 * - `closed`: the buyer withdrew the request, the purchase was cancelled or refunded, or the buyer
 *   collected the work in person instead.
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

/**
 * Why a delivery is closed: the buyer withdrew the request, the purchase was cancelled or
 * refunded, or the buyer collected the work in person.
 */
export type DeliveryClosedReason = "withdrawn" | "cancelled" | "collected";

export type DeliveryStatusFacts = {
  quote: DeliveryQuoteStatus;
  /** The lot's fulfilment record, when one exists yet (it is made at payment). */
  fulfilment: FulfilmentFacts | null;
  /** The purchase's invoice, as the buyer's purchase page reads it (`purchaseInvoiceState`). */
  invoice: PurchaseInvoiceStatus;
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
 * did next. Otherwise it follows the buyer's purchase page (`purchaseDeliveryStage`), so staff and
 * buyer never disagree: a cancelled or refunded purchase is closed, a lot collected in person is
 * closed (the courier was not used), a shipping fulfilment in transit is on the way, a delivered
 * one is delivered, and until the work moves the quote says where things stand.
 *
 * The Deliveries read model filters by the same rule in SQL; its integration test checks the two
 * agree for every combination.
 */
export function deliveryStatusOf(facts: DeliveryStatusFacts): DeliveryStatusResult {
  const { quote, fulfilment, invoice } = facts;
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
  const fromQuote = (): DeliveryStatusResult => result(FROM_QUOTE[quote]);
  switch (purchaseDeliveryStage({ invoice, fulfilment, quote })) {
    case "cancelled":
      return result("closed", "cancelled");
    case "collected":
      return result("closed", "collected");
    case "delivered":
      return result("delivered");
    case "in_transit":
      // D2: on the way means a courier has it. A collection fulfilment never leaves in transit.
      return fulfilment?.method === "collection" ? fromQuote() : result("on_the_way");
    default:
      return fromQuote();
  }
}
