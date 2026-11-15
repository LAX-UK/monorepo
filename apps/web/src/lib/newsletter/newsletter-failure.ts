/**
 * The newsletter form's one failure, kept apart from the full auth error map so the pages that show
 * the form (the home page, the empty sales calendar) do not ship every sign-in message with it.
 * `AUTH_ERROR_MESSAGES.newsletter_submit_failed` is this same text.
 */
export const NEWSLETTER_SUBMIT_FAILED_MESSAGE =
  "We could not subscribe you right now. Please try again later.";

export function newsletterSubmitFailure(): {
  ok: false;
  code: "newsletter_submit_failed";
  message: string;
} {
  return { ok: false, code: "newsletter_submit_failed", message: NEWSLETTER_SUBMIT_FAILED_MESSAGE };
}
