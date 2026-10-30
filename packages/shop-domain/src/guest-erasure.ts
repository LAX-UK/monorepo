import type { ShopFulfilmentStatus } from "./fulfilment-state.js";
import { normaliseGuestEmail } from "./guest-checkout.js";
import type { ShopOrderStatus } from "./order-state.js";

/**
 * Erasing a guest's personal data on request (UK GDPR article 17).
 *
 * What goes: the guest's name, email and phone on the lead; the delivery name, phone and address
 * on their orders; the contact details and message of the enquiries they sent as a guest; the
 * emailed order links; and the lead in the CRM.
 *
 * What stays, and why: each order and its invoice, with the amounts, VAT, dates, invoice number
 * and delivery country. UK law requires accounting records to be kept for six years from the end
 * of the financial year (Companies Act 2006 s.388, and HMRC for VAT), and article 17(3)(b) lets
 * a legal obligation outweigh erasure. The kept records hold no name, email, phone or street
 * address once the guest is erased.
 */
export const GUEST_RECORD_RETENTION_YEARS = 6;

/** Why erasure cannot go ahead now. */
export type GuestErasureBlock = "already_erased" | "claimed" | "open_order";

export type GuestErasureOrder = {
  reference: string;
  status: ShopOrderStatus;
  /** Null when the order has no fulfilment record yet. */
  fulfilmentStatus: ShopFulfilmentStatus | null;
};

export type GuestErasureDecision =
  | { kind: "allowed" }
  | { kind: "blocked"; reason: GuestErasureBlock; openOrderReferences: string[] };

/** Fulfilment that has finished: nothing more needs the guest's address or phone. */
const FINISHED_FULFILMENT: ReadonlySet<ShopFulfilmentStatus> = new Set([
  "collected",
  "delivered",
  "cancelled",
]);

/** Order states that are still live for the guest; the rest are over and can be redacted. */
const LIVE_ORDER_STATUSES: ReadonlySet<ShopOrderStatus> = new Set([
  "pending_payment",
  "paid",
  "partially_refunded",
]);

/**
 * An order still in progress needs the guest's contact details: a checkout still open, or a paid
 * order whose print has not been delivered, collected or cancelled (a print in LAX storage is
 * still being looked after for them).
 */
export function isGuestOrderOpen(order: GuestErasureOrder): boolean {
  if (!LIVE_ORDER_STATUSES.has(order.status)) return false;
  if (order.status === "pending_payment") return true;
  return order.fulfilmentStatus === null || !FINISHED_FULFILMENT.has(order.fulfilmentStatus);
}

/**
 * Whether a guest's data can be erased now. A claimed guest's orders belong to a LAX account,
 * whose data is erased by closing that account; an order still in progress is finished first.
 */
export function decideGuestErasure(input: {
  erasedAt: Date | null;
  claimedAt: Date | null;
  orders: readonly GuestErasureOrder[];
}): GuestErasureDecision {
  if (input.erasedAt) return { kind: "blocked", reason: "already_erased", openOrderReferences: [] };
  if (input.claimedAt) return { kind: "blocked", reason: "claimed", openOrderReferences: [] };
  const open = input.orders.filter(isGuestOrderOpen).map((order) => order.reference);
  if (open.length > 0) return { kind: "blocked", reason: "open_order", openOrderReferences: open };
  return { kind: "allowed" };
}

/** Staff explain why erasure cannot happen, in a sentence a person can act on. */
export function guestErasureBlockMessage(decision: GuestErasureDecision): string | null {
  if (decision.kind === "allowed") return null;
  switch (decision.reason) {
    case "already_erased":
      return "This guest's personal data has already been erased.";
    case "claimed":
      return "This guest now has a LAX account. Their data is erased by closing that account.";
    case "open_order":
      return `Finish or cancel ${decision.openOrderReferences.join(", ")} first: the order still needs the guest's details.`;
  }
}

/**
 * The value an erased lead's email becomes. Unique per lead (the email column is unique) and
 * plainly not an address, so nothing can ever be sent to it.
 */
export function erasedGuestEmail(guestCustomerId: string): string {
  return `erased:${guestCustomerId}`;
}

export function isErasedGuestEmail(email: string): boolean {
  return email.startsWith("erased:");
}

/** What an erased guest enquiry's message reads, so staff see why it is empty. */
export const ERASED_ENQUIRY_MESSAGE = "Erased on request.";

/** Staff confirm by typing the guest's email; case and surrounding space do not matter. */
export function guestErasureConfirmed(input: { typed: string; email: string }): boolean {
  return normaliseGuestEmail(input.typed) === normaliseGuestEmail(input.email);
}

/** The longest reason staff can record; it goes into the audit log. */
export const GUEST_ERASURE_REASON_MAX_LENGTH = 500;
export const GUEST_ERASURE_REASON_MIN_LENGTH = 10;
