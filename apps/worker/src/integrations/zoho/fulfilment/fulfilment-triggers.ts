/** What a domain event asks the fulfilment mirror to bring into line. */
export type FulfilmentTrigger =
  /** A prints listing: its print group, ledger and register row. The id is the listing's artwork. */
  | { kind: "group"; artworkId: string }
  /** An order's print lines. Not built yet; the mirror answers that it was skipped. */
  | { kind: "order"; orderId: string };

type TriggerKind = FulfilmentTrigger["kind"];

/**
 * The events the fulfilment mirror hears, and what each one is about. A table, so a new event is
 * one more line and nothing else changes.
 */
export const FULFILMENT_TRIGGER_KINDS: Readonly<Record<string, TriggerKind>> = {
  "shop.editions.allocated": "group",
  "shop.artwork.updated": "group",
  "shop.order.paid": "order",
  "shop.edition.sold": "order",
  "shop.edition.released": "order",
  "shop.fulfilment.dispatched": "order",
  "shop.fulfilment.status_changed": "order",
  "shop.print.pack_confirmed": "order",
  "shop.print.swapped": "order",
};

export type FulfilmentEvent = { eventType: string; aggregateId?: string };

/** The work an event is about, or null when the mirror does not handle the event or lacks an id. */
export function fulfilmentTriggerOf(event: FulfilmentEvent): FulfilmentTrigger | null {
  const kind = FULFILMENT_TRIGGER_KINDS[event.eventType];
  const id = event.aggregateId?.trim();
  if (!kind || !id) return null;
  return kind === "group" ? { kind, artworkId: id } : { kind, orderId: id };
}
