export function callbackErrorMessage(error: string): string {
  switch (error) {
    case "access_denied":
      return "You cancelled sign-in or access was not granted.";
    case "invalid_state":
      return "Your sign-in session expired or was interrupted. Please try again.";
    case "token_exchange_failed":
      return "We could not exchange your sign-in code. Please try again.";
    case "invalid_id_token":
      return "We could not verify your identity token. Please try again.";
    case "missing_sid":
      return "Your session could not be established. Please try again.";
    case "server_error":
    case "temporarily_unavailable":
      return "LAX Identity is temporarily unavailable. Please try again shortly.";
    default:
      return "We could not complete sign-in. Please try again.";
  }
}
