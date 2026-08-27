import { normalizeApiErrorMessage } from "@auction/validators";

const KYC_KNOWN_ERRORS: Record<string, string> = {
  kyc_not_configured: "Identity verification is temporarily unavailable. Please try again later.",
  kyc_already_approved: "Your identity is already verified.",
  kyc_return_url_must_be_https:
    "Identity verification needs a secure HTTPS connection. Please use the secure site and try again.",
  kyc_return_url_invalid:
    "The verification return link is invalid. Refresh the page and try again.",
};

function kycStatusFallback(status: number): string | null {
  switch (status) {
    case 400:
      return "We couldn’t start identity verification. Refresh the page and try again.";
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
