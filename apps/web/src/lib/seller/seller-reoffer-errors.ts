/**
 * The refusals after which a request is no longer waiting for the seller: it closed, was answered
 * or withdrawn, or someone changed it first. The page then reloads to show where it stands,
 * rather than leaving the seller to retry an answer that can no longer be given.
 */
const SETTLED_CODES: ReadonlySet<string> = new Set([
  "consent_window_ended",
  "consent_already_answered",
  "consent_not_requested",
  "consent_not_allowed",
  "offer_not_open",
  "lapsed_request_closed",
  "conflict",
]);

export function sellerReofferIsSettled(errorCode: string | undefined): boolean {
  return errorCode !== undefined && SETTLED_CODES.has(errorCode);
}
