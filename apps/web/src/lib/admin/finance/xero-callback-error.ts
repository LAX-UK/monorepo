/**
 * The Xero callback reports a failure to the integrations page as a fixed code in the URL. The
 * page shows the matching sentence, so neither the API's error text nor anything typed into a
 * crafted link reaches the screen.
 */
export const XERO_CALLBACK_ERROR_MESSAGES = {
  missing_state:
    "The Xero sign-in did not return to this page properly. Start the connection again.",
  not_authorised: "Your account is not allowed to connect Xero.",
  rejected:
    "Xero could not be connected. The sign-in may have expired. Start the connection again.",
  unavailable: "Xero could not be connected right now. Try again in a few minutes.",
} as const;

export type XeroCallbackErrorCode = keyof typeof XERO_CALLBACK_ERROR_MESSAGES;

/** Maps the API's response status to a code; the response body is never used. */
export function xeroCallbackErrorCodeForStatus(status: number): XeroCallbackErrorCode {
  if (status === 401 || status === 403) return "not_authorised";
  if (status === 400 || status === 404 || status === 409 || status === 422) return "rejected";
  return "unavailable";
}

/** The sentence for a code from the URL, or null when the value is not one of ours. */
export function xeroCallbackErrorMessage(value: string | undefined): string | null {
  if (!value) return null;
  return Object.hasOwn(XERO_CALLBACK_ERROR_MESSAGES, value)
    ? XERO_CALLBACK_ERROR_MESSAGES[value as XeroCallbackErrorCode]
    : "Xero could not be connected.";
}
