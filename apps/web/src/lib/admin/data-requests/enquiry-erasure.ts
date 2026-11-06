import type { DataRequestRecord } from "@auction/identity-contracts/data-requests";
import { z } from "zod";
import type { ActionState } from "./data-request-actions";

/**
 * Erasing a person's enquiries from a data request: what the action offers, what the dialog
 * checks, and how the API's answer reads. The API erases by email address and holds enquiries
 * that belong to a deal; it cannot say beforehand how many there are, so "none found" is an
 * answer, not a state of the button.
 */

export const ERASURE_REASON_MIN_LENGTH = 5;
export const ERASURE_REASON_MAX_LENGTH = 500;

export const NO_EMAIL_REASON = "This request has no email address to erase enquiries by.";

/** Hidden on a request about the signed-in person; disabled, with the reason, without an email. */
export function enquiryErasureState(
  record: Pick<DataRequestRecord, "ownRequest" | "person">,
): ActionState {
  if (record.ownRequest) return { kind: "hidden" };
  if (!record.person.email) return { kind: "disabled", reason: NO_EMAIL_REASON };
  return { kind: "enabled" };
}

/** What the API reports after an erasure. */
export const enquiryErasureCountsSchema = z.object({
  enquiries: z.number().int().nonnegative(),
  notes: z.number().int().nonnegative(),
  attachments: z.number().int().nonnegative(),
  held: z.number().int().nonnegative(),
});
export type EnquiryErasureCounts = z.infer<typeof enquiryErasureCountsSchema>;

/** The refusals the API gives, one sentence each. */
export const ERASURE_ERROR_COPY = {
  confirmation_mismatch: "The email address you typed doesn't match.",
  reason_invalid: `Give a reason of ${ERASURE_REASON_MIN_LENGTH} to ${ERASURE_REASON_MAX_LENGTH} characters.`,
} as const;

const UNAVAILABLE = "The enquiries service didn't answer. Nothing was changed. Try again.";

/** The sentence for a failed erasure: the API's own refusal, or a plain "didn't answer". */
export function erasureErrorMessage(code: string | undefined, status: number | undefined): string {
  if (code === "confirmation_mismatch" || code === "reason_invalid") {
    return ERASURE_ERROR_COPY[code];
  }
  if (status === 403) return "You don't have permission to erase enquiries.";
  return UNAVAILABLE;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export type ErasureOutcome =
  | { kind: "erased"; message: string; heldMessage: string | null }
  | { kind: "held_only"; message: string; heldMessage: string }
  | { kind: "none_found"; message: string };

/** The held sentence: a held enquiry became a deal and stays until the deal closes. */
export function heldMessage(held: number): string | null {
  if (held === 0) return null;
  return held === 1
    ? "1 enquiry became a deal, so it is kept until the deal closes."
    : `${held} enquiries became deals, so they are kept until the deals close.`;
}

/** Reads the counts as staff need them: erased, erased with some held, only held, or none. */
export function erasureOutcome(counts: EnquiryErasureCounts): ErasureOutcome {
  const held = heldMessage(counts.held);
  if (counts.enquiries === 0 && held) {
    return { kind: "held_only", message: "No enquiries were erased.", heldMessage: held };
  }
  if (counts.enquiries === 0) {
    return { kind: "none_found", message: "No enquiries were found for this email address." };
  }
  return {
    kind: "erased",
    message: `${plural(counts.enquiries, "enquiry", "enquiries")} erased.`,
    heldMessage: held,
  };
}

export type ErasureDraft = { confirmation: string; reason: string };
export type ErasureField = "confirmation" | "reason";

/** The dialog's checks before anything is sent; the API checks the same two rules again. */
export function validateErasure(
  draft: ErasureDraft,
  email: string,
): Partial<Record<ErasureField, string>> {
  const errors: Partial<Record<ErasureField, string>> = {};
  if (draft.confirmation.trim().toLowerCase() !== email.trim().toLowerCase()) {
    errors.confirmation = ERASURE_ERROR_COPY.confirmation_mismatch;
  }
  const reason = draft.reason.trim();
  if (reason.length < ERASURE_REASON_MIN_LENGTH || reason.length > ERASURE_REASON_MAX_LENGTH) {
    errors.reason = ERASURE_ERROR_COPY.reason_invalid;
  }
  return errors;
}
