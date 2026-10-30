import type { ShopFulfilmentStatus } from "./fulfilment-state.js";
import { normaliseGuestEmail } from "./guest-checkout.js";
import type { ShopOrderStatus } from "./order-state.js";

/**
 * Erasing a guest's personal data on request (UK GDPR article 17).
 *
 * What goes at once: the lead (name, email, phone, marketing consent) and its CRM record; the
 * delivery phone on their orders; the emailed order links; the contact details and message of the
 * enquiries they sent as a guest; and waiting edition alerts.
 *
 * What stays, and why: the order and invoice record, which the law requires: amounts, VAT, dates,
 * invoice number, and the buyer's name and address as the VAT invoice shows them. UK accounting
 * records are kept for six years from the end of the financial year (Companies Act 2006 s.388;
 * HMRC for VAT records), and article 17(3)(b) lets that legal obligation outweigh erasure. The
 * kept name and address are shown only to people who handle invoices (finance and
 * Administrators), and a scheduled purge clears them once the six years have passed.
 *
 * When it waits: while anything still needs to reach the guest. An order in progress, a refund
 * not yet settled, an open dispute, return or problem report, or a cancellation window still
 * open all need the guest's contact details, so erasure waits until they are over.
 */
export const GUEST_RECORD_RETENTION_YEARS = 6;

/** The last day of a financial year, as month (1-12) and day. */
export type FinancialYearEnd = { month: number; day: number };

/**
 * London Art Exchange Ltd's accounting reference date (30 September, from its public filings).
 * It is the default only: shop-api reads the date from configuration, so it can be corrected
 * without a code change.
 */
export const DEFAULT_FINANCIAL_YEAR_END: FinancialYearEnd = { month: 9, day: 30 };

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** Reads "MM-DD" ("09-30"); null when it is not a real day of the year. */
export function parseFinancialYearEnd(value: string): FinancialYearEnd | null {
  const match = /^(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > (DAYS_IN_MONTH[month - 1] ?? 0)) return null;
  return { month, day };
}

function yearEndIn(year: number, end: FinancialYearEnd): number {
  // A 29 February year end falls back to the 28th in a common year.
  const lastDay = new Date(Date.UTC(year, end.month, 0)).getUTCDate();
  return Date.UTC(year, end.month - 1, Math.min(end.day, lastDay), 23, 59, 59);
}

/**
 * When an erased guest's invoice name and address may be purged: six years after the end of the
 * financial year in which the order was paid (or placed, if it was never paid). This is never
 * shorter than HMRC's six-year VAT record retention, which runs from the invoice date.
 */
export function guestInvoiceRetentionEndsAt(soldAt: Date, yearEnd: FinancialYearEnd): Date {
  const year = soldAt.getUTCFullYear();
  const financialYearEndYear = soldAt.getTime() <= yearEndIn(year, yearEnd) ? year : year + 1;
  return new Date(yearEndIn(financialYearEndYear + GUEST_RECORD_RETENTION_YEARS, yearEnd));
}

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
