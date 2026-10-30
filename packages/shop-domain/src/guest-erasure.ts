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
 *
 * When it waits: while anything still needs to reach the guest. An order in progress, a refund
 * not yet settled, an open dispute, return or problem report, or a cancellation window still
 * open all need the guest's contact details, so erasure waits until they are over.
 */
export const GUEST_RECORD_RETENTION_YEARS = 6;

/** Why erasure cannot go ahead now, in the order they are checked. */
export type GuestErasureBlock =
  | "already_erased"
  | "claimed"
  | "open_order"
  | "open_refund"
  | "open_case"
  | "cancellation_window";

export type GuestErasureOrder = {
  reference: string;
  status: ShopOrderStatus;
  /** Null when the order has no fulfilment record yet. */
  fulfilmentStatus: ShopFulfilmentStatus | null;
  /** A refund requested and not yet succeeded, failed or cancelled. */
  openRefund: boolean;
  /** An open dispute, return or Report-a-problem case. */
  openCase: boolean;
  /** When the buyer's right to cancel ends; null when it has not started or does not apply. */
  cancellationEndsAt: Date | null;
};

export type GuestErasureDecision =
  | { kind: "allowed" }
  | {
      kind: "blocked";
      reason: GuestErasureBlock;
      /** The orders behind the block, by reference. */
      orderReferences: string[];
      /** For a cancellation window: the last day it is open. */
      until?: Date;
    };

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
export function isGuestOrderOpen(order: Pick<GuestErasureOrder, "status" | "fulfilmentStatus">) {
  if (!LIVE_ORDER_STATUSES.has(order.status)) return false;
  if (order.status === "pending_payment") return true;
  return order.fulfilmentStatus === null || !FINISHED_FULFILMENT.has(order.fulfilmentStatus);
}

function inCancellationWindow(order: GuestErasureOrder, now: Date): boolean {
  return (
    LIVE_ORDER_STATUSES.has(order.status) &&
    order.cancellationEndsAt !== null &&
    order.cancellationEndsAt.getTime() > now.getTime()
  );
}

/** Each order check, as a row: a new reason to wait is one more entry, not another branch. */
const ORDER_CHECKS: ReadonlyArray<{
  reason: Exclude<GuestErasureBlock, "already_erased" | "claimed">;
  applies: (order: GuestErasureOrder, now: Date) => boolean;
}> = [
  { reason: "open_order", applies: (order) => isGuestOrderOpen(order) },
  { reason: "open_refund", applies: (order) => order.openRefund },
  { reason: "open_case", applies: (order) => order.openCase },
  { reason: "cancellation_window", applies: inCancellationWindow },
];

/**
 * Whether a guest's data can be erased now. A claimed guest's orders belong to a LAX account,
 * whose data is erased by closing that account; anything still in progress is finished first.
 */
export function decideGuestErasure(input: {
  erasedAt: Date | null;
  claimedAt: Date | null;
  orders: readonly GuestErasureOrder[];
  now: Date;
}): GuestErasureDecision {
  if (input.erasedAt) return { kind: "blocked", reason: "already_erased", orderReferences: [] };
  if (input.claimedAt) return { kind: "blocked", reason: "claimed", orderReferences: [] };
  for (const check of ORDER_CHECKS) {
    const hit = input.orders.filter((order) => check.applies(order, input.now));
    if (hit.length === 0) continue;
    if (check.reason === "cancellation_window") {
      const until = new Date(Math.max(...hit.map((o) => o.cancellationEndsAt?.getTime() ?? 0)));
      return {
        kind: "blocked",
        reason: check.reason,
        orderReferences: hit.map((o) => o.reference),
        until,
      };
    }
    return { kind: "blocked", reason: check.reason, orderReferences: hit.map((o) => o.reference) };
  }
  return { kind: "allowed" };
}

function formatDay(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  });
}

/** Staff read why erasure cannot happen, in a sentence they can act on. */
export function guestErasureBlockMessage(decision: GuestErasureDecision): string | null {
  if (decision.kind === "allowed") return null;
  const orders = decision.orderReferences.join(", ");
  switch (decision.reason) {
    case "already_erased":
      return "This guest's personal data has already been erased.";
    case "claimed":
      return "This guest now has a LAX account. Their data is erased by closing that account.";
    case "open_order":
      return `Available once ${orders} is delivered, collected or cancelled.`;
    case "open_refund":
      return `Available once the refund on ${orders} has gone through.`;
    case "open_case":
      return `Available once the dispute, return or problem report on ${orders} is closed.`;
    case "cancellation_window":
      return `Available after ${formatDay(decision.until ?? new Date())}, when the right to cancel ${orders} ends.`;
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
