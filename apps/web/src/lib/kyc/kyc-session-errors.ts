export function mapKycSessionStartError(error: unknown, status: number): string {
  if (typeof error === "string") {
    switch (error) {
      case "kyc_not_configured":
        return "Identity verification is temporarily unavailable. Please try again later.";
      case "kyc_already_approved":
        return "Your identity is already verified.";
      case "kyc_return_url_must_be_https":
      case "kyc_return_url_invalid":
        return "Could not start verification from this page. Open verify identity from the dashboard and try again.";
      default:
        if (status === 503) {
          return "Identity verification is temporarily unavailable. Please try again later.";
        }
        if (status === 409) {
          return "Your identity is already verified.";
        }
        return error ?? `Could not start verification (${status}). Please try again.`;
    }
  }

  if (status === 400) {
    return "Could not start verification from this page. Open verify identity from the dashboard and try again.";
  }
  if (status === 503) {
    return "Identity verification is temporarily unavailable. Please try again later.";
  }
  if (status === 409) {
    return "Your identity is already verified.";
  }
  return `Could not start verification (${status}). Please try again.`;
}
