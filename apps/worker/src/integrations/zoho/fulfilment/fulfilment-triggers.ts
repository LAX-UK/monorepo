import { FULFILMENT_TRIGGER_KINDS, ORDER_EVENTS_THAT_SET_PRINTS } from "@auction/types";

/** What a domain event asks the fulfilment mirror to bring into line. */
export type FulfilmentTrigger =
  /** A prints listing: its print group, ledger and register row. The id is the listing's artwork. */
  | { kind: "group"; artworkId: string }
  /**
   * An order's print lines, framing and dispatch. The id is the order's, from the payload.
   * `reportsProblems` is true for the events that set which prints are on the order.
   */
  | { kind: "order"; orderId: string; reportsProblems: boolean };

/**
 * The table of events the fulfilment mirror hears and the events that set an order's prints live in
 * `@auction/types`, beside the skip reasons, so LAX Admin's "Mirrored to Zoho" read uses the same
 * lists. Re-exported here for the worker.
 */
export { FULFILMENT_TRIGGER_KINDS, ORDER_EVENTS_THAT_SET_PRINTS };

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
