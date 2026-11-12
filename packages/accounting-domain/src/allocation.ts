import { isValidIsoDate } from "./dates.js";
import { type Pence, isPence } from "./money.js";
import { type Result, ok, refuse } from "./result.js";
import { compareText } from "./text.js";

export interface OpenInvoice {
  readonly reference: string;
  /** ISO date `YYYY-MM-DD`; compares correctly as text. */
  readonly dueOn: string;
  readonly outstandingPence: Pence;
}

export interface Allocation {
  readonly invoiceReference: string;
  readonly amountPence: Pence;
}

export interface AllocationPlan {
  readonly allocations: readonly Allocation[];
  /** Money received that no invoice could take. Reported, never forced onto an invoice. */
  readonly unallocatedPence: Pence;
}

/**
 * Spread one payment across invoices, oldest due first (ties by reference, so the result is
 * deterministic). Each invoice gets at most its outstanding amount; the remainder is reported.
 */
export function allocatePayment(
  paymentPence: Pence,
  invoices: readonly OpenInvoice[],
): Result<AllocationPlan, "bad_amount" | "bad_due_date" | "duplicate_invoice"> {
  if (!isPence(paymentPence) || paymentPence <= 0) {
    return refuse("bad_amount", "payment must be positive whole pence");
  }
  const seen = new Set<string>();
  for (const invoice of invoices) {
    if (!isPence(invoice.outstandingPence) || invoice.outstandingPence < 0) {
      return refuse("bad_amount", `outstanding on ${invoice.reference} is not valid pence`);
    }
    if (!isValidIsoDate(invoice.dueOn)) {
      return refuse(
        "bad_due_date",
        `due date on ${invoice.reference} is not a real YYYY-MM-DD date`,
      );
    }
    if (seen.has(invoice.reference)) {
      return refuse("duplicate_invoice", `${invoice.reference} listed twice`);
    }
    seen.add(invoice.reference);
  }
  const ordered = [...invoices].sort(
    (a, b) => compareText(a.dueOn, b.dueOn) || compareText(a.reference, b.reference),
  );
  let remaining = paymentPence;
  const allocations: Allocation[] = [];
  for (const invoice of ordered) {
    if (remaining === 0) break;
    const amountPence = Math.min(remaining, invoice.outstandingPence);
    if (amountPence === 0) continue;
    allocations.push({ invoiceReference: invoice.reference, amountPence });
    remaining -= amountPence;
  }
  return ok({ allocations, unallocatedPence: remaining });
}
