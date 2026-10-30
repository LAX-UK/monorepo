import { INVOICE_PAYMENT_DUE_DAYS } from "@auction/types";

const DAY_MS = 86_400_000;

/** The invoice behind a won lot, as far as its payment state needs to know it. */
export type PurchaseInvoiceFacts = {
  /** The latest payment row for the lot and account, or `null` while no invoice is raised yet. */
  payment: {
    status:
      | "pending"
      | "authorized"
      | "captured"
      | "refunded"
      | "requires_manual_review"
      | "cancelled";
    /** When the invoice was raised (the payment row was created). */
    raisedAt: Date;
  } | null;
};

/**
 * Where a purchase's invoice stands:
 * - `not_invoiced`: the lot is won but no invoice is raised yet;
 * - `due`: raised and unpaid, inside the payment terms;
 * - `overdue`: raised and unpaid past the due date;
 * - `processing`: paid by the buyer and being confirmed (card authorised or held for review);
 * - `paid`, `refunded`: settled;
 * - `cancelled`: the invoice was withdrawn (for example the lot was re-awarded).
 */
export type PurchaseInvoiceStatus =
  | "not_invoiced"
  | "due"
  | "overdue"
  | "processing"
  | "paid"
  | "refunded"
  | "cancelled";

export type PurchaseInvoiceState = {
  status: PurchaseInvoiceStatus;
  /** The payment due date; `null` while no invoice is raised. */
  dueAt: Date | null;
};

const SETTLED: Record<
  Exclude<NonNullable<PurchaseInvoiceFacts["payment"]>["status"], "pending">,
  PurchaseInvoiceStatus
> = {
  authorized: "processing",
  requires_manual_review: "processing",
  captured: "paid",
  refunded: "refunded",
  cancelled: "cancelled",
};

/** The due date of an invoice raised at `raisedAt`: the payment terms, the same for every sale. */
export function invoiceDueAt(raisedAt: Date): Date {
  return new Date(raisedAt.getTime() + INVOICE_PAYMENT_DUE_DAYS * DAY_MS);
}

/**
 * The invoice state of a purchase at `now`. An unpaid invoice is overdue from the moment its due
 * date passes; it never stops being owed, so "overdue" replaces "due" rather than ending it.
 */
export function purchaseInvoiceState(facts: PurchaseInvoiceFacts, now: Date): PurchaseInvoiceState {
  const { payment } = facts;
  if (!payment) return { status: "not_invoiced", dueAt: null };
  const dueAt = invoiceDueAt(payment.raisedAt);
  if (payment.status !== "pending") return { status: SETTLED[payment.status], dueAt };
  return { status: now.getTime() > dueAt.getTime() ? "overdue" : "due", dueAt };
}

/** Whether the invoice is still owed by the buyer (it can be paid now). */
export function invoiceIsOwed(status: PurchaseInvoiceStatus): boolean {
  return status === "due" || status === "overdue" || status === "not_invoiced";
}
