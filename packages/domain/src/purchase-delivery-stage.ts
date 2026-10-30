import type { DeliveryQuoteStatus } from "./delivery-quote.js";
import type { PurchaseInvoiceStatus } from "./purchase-invoice-state.js";

/** The saleroom's fulfilment record for a won lot (`lot_fulfilment`), when one exists. */
export type FulfilmentFacts = {
  status:
    | "awaiting_payment"
    | "awaiting_release"
    | "released"
    | "ready_for_collection"
    | "in_transit"
    | "delivered"
    | "cancelled";
  method: "collection" | "shipping" | null;
};

export type PurchaseDeliveryFacts = {
  invoice: PurchaseInvoiceStatus;
  fulfilment: FulfilmentFacts | null;
  quote: DeliveryQuoteStatus | null;
};

/**
 * What the delivery panel shows for a purchase, in the order a buyer meets them:
 * - `awaiting_payment`: nothing to arrange until the invoice is paid;
 * - `choose`: paid, and no delivery chosen yet (courier quote, own shipper or collection);
 * - `quote_requested`, `quote_ready`: a courier quote is being priced, or is ready to accept;
 * - `booked`: a quote was accepted and the delivery is being prepared;
 * - `preparing`: collection was chosen and the saleroom is releasing the work;
 * - `ready_to_collect`, `in_transit`: the work can be collected, or is on its way;
 * - `delivered`, `collected`: done;
 * - `cancelled`: the purchase was cancelled or refunded.
 */
export type PurchaseDeliveryStage =
  | "awaiting_payment"
  | "choose"
  | "quote_requested"
  | "quote_ready"
  | "booked"
  | "preparing"
  | "ready_to_collect"
  | "in_transit"
  | "delivered"
  | "collected"
  | "cancelled";

/** Fulfilment states that settle the stage whatever the quote says: the work has moved. */
const MOVED: Partial<
  Record<FulfilmentFacts["status"], (f: FulfilmentFacts) => PurchaseDeliveryStage>
> = {
  cancelled: () => "cancelled",
  delivered: (f) => (f.method === "collection" ? "collected" : "delivered"),
  in_transit: () => "in_transit",
  ready_for_collection: () => "ready_to_collect",
};

const QUOTE_STAGE: Record<DeliveryQuoteStatus, PurchaseDeliveryStage | null> = {
  requested: "quote_requested",
  quoted: "quote_ready",
  accepted: "booked",
  withdrawn: null,
};

/**
 * The one delivery stage for a purchase. The fulfilment record wins once the work moves; a
 * courier quote can be asked for before paying (so the buyer knows the full cost), so it shows
 * whatever the invoice says; otherwise nothing is arranged until the invoice is paid.
 */
export function purchaseDeliveryStage(facts: PurchaseDeliveryFacts): PurchaseDeliveryStage {
  const { invoice, fulfilment, quote } = facts;
  if (invoice === "refunded" || invoice === "cancelled") return "cancelled";
  const moved = fulfilment ? MOVED[fulfilment.status] : undefined;
  if (moved && fulfilment) return moved(fulfilment);
  const fromQuote = quote ? QUOTE_STAGE[quote] : null;
  if (fromQuote) return fromQuote;
  if (invoice !== "paid") return "awaiting_payment";
  if (fulfilment?.method === "collection") return "preparing";
  if (fulfilment?.method === "shipping") return "booked";
  return "choose";
}
