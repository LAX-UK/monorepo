import type { DisputeAllocationError } from "./dispute-allocation.service.js";

/** What the finance team is told when an allocation is refused, and the status it answers with. */
export const DISPUTE_ALLOCATION_REFUSALS: Record<
  DisputeAllocationError,
  { status: 404 | 409 | 422; message: string }
> = {
  not_found: { status: 404, message: "This dispute could not be found." },
  version_conflict: {
    status: 409,
    message: "This dispute changed while you were working on it. Reload it and try again.",
  },
  already_allocated: { status: 409, message: "This dispute has already been allocated." },
  no_lines: { status: 422, message: "Allocate the dispute to at least one invoice." },
  duplicate_payment: { status: 422, message: "Each invoice can appear only once." },
  unknown_payment: { status: 422, message: "One of the invoices could not be found." },
  not_a_candidate: {
    status: 422,
    message: "One of the invoices was not paid by the disputed charge.",
  },
  amount_not_positive: { status: 422, message: "Each share must be more than zero." },
  exceeds_invoice: { status: 422, message: "A share cannot be more than its invoice total." },
  total_mismatch: {
    status: 422,
    message: "The shares must add up to the disputed amount.",
  },
};
