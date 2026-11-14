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

export type ExactAllocationCode = "bad_amount" | "bad_allocation" | "allocation_mismatch";

/**
 * Allocations that must account for every penny of a payment: each one is a stored amount (an
 * invoice's payment row, a courier quote's charge), given whole, and together they equal the
 * payment exactly. Nothing is split, rounded or spread here, so there is no remainder to place: a
 * sum that is a penny out either way is refused (`allocation_mismatch`), never absorbed.
 */
export function checkExactAllocations(
  paymentPence: Pence,
  allocations: readonly Allocation[],
): Result<readonly Allocation[], ExactAllocationCode> {
  if (!isPence(paymentPence) || paymentPence <= 0) {
    return refuse("bad_amount", "payment must be positive whole pence");
  }
  if (allocations.length === 0) return refuse("bad_allocation", "a payment needs an allocation");
  const seen = new Set<string>();
  let allocated = 0;
  for (const allocation of allocations) {
    if (!isPence(allocation.amountPence) || allocation.amountPence <= 0) {
      return refuse("bad_allocation", "each allocation must be positive whole pence");
    }
    if (seen.has(allocation.invoiceReference)) {
      return refuse("bad_allocation", `${allocation.invoiceReference} is allocated twice`);
    }
    seen.add(allocation.invoiceReference);
    allocated += allocation.amountPence;
  }
  if (allocated !== paymentPence) {
    return refuse(
      "allocation_mismatch",
      `allocations total ${allocated} pence, the payment is ${paymentPence} pence`,
    );
  }
  return ok(allocations);
}
