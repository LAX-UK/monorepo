import type { AuthErrorCode } from "@/lib/auth/auth-error-code";

const SKIP_TURNSTILE_RESET: AuthErrorCode[] = ["rate_limited", "registration_validation"];

/** After a failed auth submit, discard the spent Turnstile token unless the failure was throttling or client validation. */
export function shouldResetTurnstileAfterFailedSubmit(code: AuthErrorCode | null): boolean {
  if (code === null) return true;
  return !SKIP_TURNSTILE_RESET.includes(code);
}

export const TURNSTILE_LOAD_ERROR_MESSAGE =
  "Security check could not load. Refresh the page or try another browser.";
