import type { Payout } from "@auction/types";

/**
 * The failure reason of a transfer attempt Stripe refused: no transfer exists, so the payout can
 * take lines and its next attempt sends the new net.
 */
export const TRANSFER_REFUSED_PREFIX = "stripe_transfer_failed:";

/**
 * The failure reason of a transfer attempt whose outcome is unknown (the connection failed or
 * Stripe answered with a server error): Stripe may hold a transfer for the amount that was read.
 * The payout keeps that amount until a later attempt finds out, so it takes no new lines.
 */
export const TRANSFER_OUTCOME_UNKNOWN_PREFIX = "stripe_transfer_outcome_unknown:";

/** Stripe error types after which a transfer may or may not have been created. */
const OUTCOME_UNKNOWN_ERROR_TYPES: ReadonlySet<string> = new Set([
  "StripeConnectionError",
  "StripeAPIError",
]);

/**
 * Whether a Stripe error from creating a transfer leaves its outcome unknown: the request may have
 * reached Stripe (a dropped connection or a server error), or another request with the same key
 * was still running. Any other error is Stripe refusing the request: no transfer was made.
 */
export function transferOutcomeUnknownAfter(error: { type?: string; code?: string }): boolean {
  return (
    (error.type !== undefined && OUTCOME_UNKNOWN_ERROR_TYPES.has(error.type)) ||
    error.code === "idempotency_key_in_use"
  );
}

/** Whether the payout's last transfer attempt ended with its outcome unknown. */
export function lastTransferOutcomeUnknown(payout: Pick<Payout, "failureReason">): boolean {
  return (payout.failureReason ?? "").startsWith(TRANSFER_OUTCOME_UNKNOWN_PREFIX);
}

/** The failure reason stored for a transfer attempt that ended in a Stripe error. */
export function transferFailureReason(input: {
  outcomeUnknown: boolean;
  errorCode: string;
  errorMessage: string;
}): string {
  const prefix = input.outcomeUnknown ? TRANSFER_OUTCOME_UNKNOWN_PREFIX : TRANSFER_REFUSED_PREFIX;
  return `${prefix} ${input.errorCode} - ${input.errorMessage}`;
}

/**
 * Whether new lines may go on the payout: only while it is `scheduled` and its last transfer
 * attempt, if any, is known not to have sent money. Otherwise the line goes on a new payout, so the
 * payout's net always equals what Stripe sends or sent for it.
 */
export function payoutTakesLines(payout: Pick<Payout, "status" | "failureReason">): boolean {
  return payout.status === "scheduled" && !lastTransferOutcomeUnknown(payout);
}
