/**
 * The wallet row's states (GAP-49). The row reserves its height while loading so nothing below
 * moves, disappears without a gap when no wallet is available, and otherwise leaves the card
 * checkout exactly as it is. Every notice is one plain line under the buttons.
 */
export type ExpressRowState =
  | { status: "loading" }
  /** No wallet on this device, or express checkout is off: nothing is shown. */
  | { status: "unavailable" }
  | { status: "ready"; notice: ExpressNotice | null }
  /** The sheet confirmed; the Shop is making the order and Stripe is taking the payment. */
  | { status: "processing" }
  /** Paid: on the way to the order confirmation. */
  | { status: "paid"; orderId: string }
  /** Stripe.js or the session could not load; the row is replaced by one line. */
  | { status: "error"; message: string }
  /** A print sold while the sheet was open; the basket reloads. */
  | { status: "sold_out"; message: string };

export type ExpressNotice = { tone: "error" | "info"; message: string };

export type ExpressRowEvent =
  | { type: "loaded"; available: boolean }
  | { type: "load_failed"; message: string }
  | { type: "disabled" }
  | { type: "confirm_started" }
  | { type: "paid"; orderId: string }
  | { type: "sold_out"; message: string }
  /** Refused or failed before any charge: the shopper may try again or use the card path. */
  | { type: "not_charged"; message: string }
  | { type: "cancelled"; message: string }
  | { type: "address_refused"; message: string };

export const INITIAL_EXPRESS_ROW_STATE: ExpressRowState = { status: "loading" };

export function expressRowReducer(state: ExpressRowState, event: ExpressRowEvent): ExpressRowState {
  // Once paid the shopper is leaving for the confirmation; nothing may change that.
  if (state.status === "paid") return state;
  switch (event.type) {
    case "loaded":
      if (state.status !== "loading") return state;
      return event.available ? { status: "ready", notice: null } : { status: "unavailable" };
    case "disabled":
      return { status: "unavailable" };
    case "load_failed":
      return state.status === "loading" ? { status: "error", message: event.message } : state;
    case "confirm_started":
      return state.status === "ready" ? { status: "processing" } : state;
    case "paid":
      return state.status === "processing" ? { status: "paid", orderId: event.orderId } : state;
    case "sold_out":
      return { status: "sold_out", message: event.message };
    case "not_charged":
      return state.status === "ready" || state.status === "processing"
        ? { status: "ready", notice: { tone: "error", message: event.message } }
        : state;
    case "cancelled":
      // Closing the sheet mid-payment is the same as a refusal: nothing was charged.
      return state.status === "ready" || state.status === "processing"
        ? { status: "ready", notice: { tone: "info", message: event.message } }
        : state;
    case "address_refused":
      return state.status === "ready"
        ? { status: "ready", notice: { tone: "error", message: event.message } }
        : state;
  }
}

/** Whether the row keeps its reserved space (the buttons are, or may yet be, there). */
export function expressRowReservesSpace(state: ExpressRowState): boolean {
  return state.status === "loading" || state.status === "ready" || state.status === "processing";
}

/** Whether the Stripe buttons are visible (they stay mounted while the sheet works). */
export function expressRowShowsButtons(state: ExpressRowState): boolean {
  return state.status === "ready" || state.status === "processing" || state.status === "paid";
}
