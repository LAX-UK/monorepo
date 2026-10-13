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

const FALLBACK_MESSAGE = "We could not complete sign-in. Please try again.";

/** Support reference for an identity callback `reason`; unknown values never echo to the page. */
export function artCallbackErrorReference(reason: string | string[] | undefined): string {
  const value = typeof reason === "string" ? reason : "";
  return Object.hasOwn(CALLBACK_ERROR_MESSAGES, value) ? value : "unknown";
}

export function artCallbackErrorMessage(reference: string): string {
  return CALLBACK_ERROR_MESSAGES[reference] ?? FALLBACK_MESSAGE;
}
