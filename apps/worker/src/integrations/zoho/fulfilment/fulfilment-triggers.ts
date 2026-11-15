/** What a domain event asks the fulfilment mirror to bring into line. */
export type FulfilmentTrigger =
  /** A prints listing: its print group, ledger and register row. The id is the listing's artwork. */
  | { kind: "group"; artworkId: string }
  /**
   * An order's print lines, framing and dispatch. The id is the order's, from the payload.
   * `reportsProblems` is true for the events that set which prints are on the order.
   */
  | { kind: "order"; orderId: string; reportsProblems: boolean };

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
  "shop.framing.status_changed": "order",
};

/**
 * The order events that set which prints are on the order: payment (raised with every print's
 * `shop.edition.sold`) and a swap. A print that cannot be mirrored fails these for staff; the
 * pick, dispatch and refund steps after them log it instead of failing the same order again.
 */
export const ORDER_EVENTS_THAT_SET_PRINTS: ReadonlySet<string> = new Set([
  "shop.order.paid",
  "shop.print.swapped",
]);

export type FulfilmentEvent = { eventType: string; aggregateId?: string; payload?: unknown };

/**
 * The order an event is about. Order events are raised on the order, its lines and its fulfilment,
 * so the aggregate is not always the order; every one of them carries `orderId` in its payload.
 */
function orderIdOf(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;
  const id = (payload as { orderId?: unknown }).orderId;
  return typeof id === "string" ? id.trim() : undefined;
}

/** The work an event is about, or null when the mirror does not handle the event or lacks an id. */
export function fulfilmentTriggerOf(event: FulfilmentEvent): FulfilmentTrigger | null {
  const kind = FULFILMENT_TRIGGER_KINDS[event.eventType];
  if (!kind) return null;
  const id = kind === "group" ? event.aggregateId?.trim() : orderIdOf(event.payload);
  if (!id) return null;
  if (kind === "group") return { kind, artworkId: id };
  return { kind, orderId: id, reportsProblems: ORDER_EVENTS_THAT_SET_PRINTS.has(event.eventType) };
}
