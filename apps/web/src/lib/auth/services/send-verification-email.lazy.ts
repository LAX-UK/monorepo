import { authSubmitFailure } from "@/lib/auth/auth-error-code";
import type { AuthSubmitResult } from "@/lib/auth/auth-submit-result";
import type { SendVerificationEmailForReturnPathInput } from "@/lib/auth/services/send-verification-email.service";

/**
 * Sends the verification email for a return path. The auth client it needs is fetched on the
 * first call, not with the page's first scripts: the buttons that call it (lot page, header
 * banner) are pressed rarely. A failed fetch reads as a failed send.
 */
export function sendVerificationEmailOnDemand(
  input: SendVerificationEmailForReturnPathInput,
): Promise<AuthSubmitResult> {
  return import("@/lib/auth/services/send-verification-email.service")
    .then((service) => service.sendVerificationEmailForReturnPath(input))
    .catch(() => authSubmitFailure("verification_email_failed"));
}
