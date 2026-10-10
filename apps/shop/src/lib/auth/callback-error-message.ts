const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "You cancelled sign-in or access was not granted.",
  invalid_state: "Your sign-in session expired or was interrupted. Please try again.",
  token_exchange_failed: "Sign-in didn’t finish. Please try again.",
  invalid_id_token: "We couldn’t confirm your sign-in. Please try again.",
  missing_sid: "Your session could not be established. Please try again.",
  missing_refresh_token: "Your session could not be established. Please try again.",
  server_error: "LAX Identity is temporarily unavailable. Please try again shortly.",
  temporarily_unavailable: "LAX Identity is temporarily unavailable. Please try again shortly.",
};

/** Support reference for a callback error; unrecognised values never echo back to the page. */
export function callbackErrorReference(error: string): string {
  return Object.hasOwn(CALLBACK_ERROR_MESSAGES, error) ? error : "unknown";
}

export function callbackErrorMessage(error: string): string {
  return (
    CALLBACK_ERROR_MESSAGES[callbackErrorReference(error)] ??
    "We could not complete sign-in. Please try again."
  );
}
