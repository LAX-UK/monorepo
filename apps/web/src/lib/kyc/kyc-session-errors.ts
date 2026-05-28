import { normalizeApiErrorMessage } from "@auction/validators";

const KYC_KNOWN_ERRORS: Record<string, string> = {
  kyc_not_configured: "Identity verification is temporarily unavailable. Please try again later.",
  kyc_already_approved: "Your identity is already verified.",
  kyc_return_url_must_be_https:
    "Could not start verification from this page. Open verify identity from the dashboard and try again.",
  kyc_return_url_invalid:
    "Could not start verification from this page. Open verify identity from the dashboard and try again.",
};

function kycStatusFallback(status: number): string | null {
  switch (status) {
    case 400:
      return "Could not start verification from this page. Open verify identity from the dashboard and try again.";
    case 503:
      return "Identity verification is temporarily unavailable. Please try again later.";
    case 409:
      return "Your identity is already verified.";
    default:
      return null;
  }
}

export function mapKycSessionStartError(error: unknown, status: number): string {
  if (typeof error === "string") {
    const known = KYC_KNOWN_ERRORS[error];
    if (known) return known;

    const statusMessage = kycStatusFallback(status);
    if (statusMessage) return statusMessage;

    return error.length > 0 ? error : `Could not start verification (${status}). Please try again.`;
  }

  const statusMessage = kycStatusFallback(status);
  if (statusMessage) return statusMessage;

  return normalizeApiErrorMessage(
    error,
    `Could not start verification (${status}). Please try again.`,
  );
}
