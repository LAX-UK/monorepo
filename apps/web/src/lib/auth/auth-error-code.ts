/** Closed set of client-normalised auth failure reasons (never show Better Auth raw `code` / stack strings in UI). */
export const AUTH_ERROR_CODES = [
  "unknown",
  "invalid_credentials",
  "email_not_verified",
  "account_suspended",
  "rate_limited",
  "sign_in_failed",
  "captcha_required",
  "captcha_invalid",
  "registration_disabled",
  "registration_validation",
  "registration_failed",
  "email_already_registered",
  "forgot_password_failed",
  "magic_link_request_failed",
  "reset_password_failed",
  "reset_token_invalid",
  "totp_invalid",
  "two_factor_session_expired",
  "backup_code_invalid",
  "two_factor_enable_failed",
  "two_factor_disable_failed",
  "two_factor_backup_regenerate_failed",
  "two_factor_unexpected_response",
  "newsletter_submit_failed",
  "session_required",
  "user_not_found",
  "email_change_same_email",
  "email_change_email_taken",
  "email_change_none_in_progress",
  "email_change_stale",
  "email_change_expired",
  "email_change_token_invalid",
  "email_change_missing_token",
  "credential_already_set",
  "setup_password_failed",
  "account_deletion_already_requested",
  "account_deletion_pending_payments",
  "account_deletion_active_seller_lots",
  "account_deletion_open_payouts",
  "recent_auth_required",
  "credential_required",
  "session_not_found",
  "session_cannot_delete_current",
  "verification_email_failed",
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  unknown: "Something went wrong. Please try again.",
  invalid_credentials: "Incorrect email or password.",
  email_not_verified: "Please verify your email before signing in.",
  account_suspended: "This account has been suspended. Contact support if you need help.",
  rate_limited: "Too many attempts. Please wait a few minutes and try again.",
  sign_in_failed: "We could not sign you in. Please check your details and try again.",
  captcha_required: "Please complete the security check and try again.",
  captcha_invalid: "Security check failed. Please try again.",
  registration_disabled: "New registrations are temporarily unavailable. Please try again later.",
  registration_validation: "Please check the highlighted fields and try again.",
  registration_failed: "We could not complete registration. Please try again.",
  email_already_registered:
    "This email is already registered. Sign in or reset your password to access your account.",
  forgot_password_failed: "Something went wrong. Please try again.",
  magic_link_request_failed: "We could not send an activation link. Please try again.",
  reset_password_failed: "We could not reset your password. Please request a new link.",
  reset_token_invalid: "This reset link has expired or was already used. Request a new one below.",
  totp_invalid: "That code is not valid. Try again.",
  two_factor_session_expired:
    "Your two-factor sign-in session expired. Please sign in again and enter your code.",
  backup_code_invalid: "That backup code is not valid. Try again.",
  two_factor_enable_failed:
    "We could not start two-factor setup. Check your password and try again.",
  two_factor_disable_failed:
    "We could not turn off two-factor authentication. Check your password and try again.",
  two_factor_backup_regenerate_failed:
    "We could not generate new backup codes. Check your password and try again.",
  two_factor_unexpected_response: "Something went wrong with two-factor setup. Please try again.",
  newsletter_submit_failed: "We could not subscribe you right now. Please try again later.",
  session_required: "You need to be signed in to do that.",
  user_not_found: "We could not find that account.",
  email_change_same_email: "The new address must be different from your current email.",
  email_change_email_taken: "That email is already in use on another account.",
  email_change_none_in_progress: "There is no email change to cancel.",
  email_change_stale:
    "That confirmation link no longer matches this account. Start again from settings.",
  email_change_expired: "This email change has expired. Start again from settings.",
  email_change_token_invalid: "That confirmation link is invalid or has expired.",
  email_change_missing_token: "Missing confirmation link. Open the link from your email again.",
  credential_already_set: "A password is already set on this account.",
  setup_password_failed: "We could not save your password. Please try again.",
  account_deletion_already_requested: "Account deletion has already been requested.",
  account_deletion_pending_payments:
    "You have unpaid pending payments; resolve them before deleting your account.",
  account_deletion_active_seller_lots:
    "You still have active or scheduled lots as a seller; withdraw or complete them first.",
  account_deletion_open_payouts:
    "Your organisation has payouts still in flight; resolve them before deletion.",
  recent_auth_required:
    "For your security, please confirm your password again before continuing. You can do this from your security settings.",
  credential_required: "This action requires a password on your account.",
  session_not_found: "That session could not be found.",
  session_cannot_delete_current:
    "You cannot remove the session you are currently using from here. Use sign out instead.",
  verification_email_failed: "Could not send verification email. Please try again.",
};

function sanitiseRegistrationDetail(raw: string): string {
  const t = raw.trim();
  if (t.length === 0 || t.length > 280) return AUTH_ERROR_MESSAGES.registration_validation;
  return t;
}

/** Maps Better Auth client `error.code` / message heuristics to a closed {@link AuthErrorCode}. */
export function mapBetterAuthClientFailure(input: {
  rawCode?: string | undefined;
  message?: string | undefined;
}): AuthErrorCode {
  const raw = (input.rawCode ?? "").toUpperCase().replace(/-/g, "_");
  const msg = (input.message ?? "").toLowerCase();

  if (
    raw.includes("NOT_VERIFIED") ||
    raw.includes("EMAIL_VERIFICATION") ||
    msg.includes("verify your email") ||
    msg.includes("email not verified") ||
    msg.includes("not verified")
  ) {
    return "email_not_verified";
  }
  if (raw.includes("SUSPEND") || raw.includes("BANNED") || msg.includes("suspended")) {
    return "account_suspended";
  }
  if (raw.includes("RATE") || raw.includes("TOO_MANY") || msg.includes("too many")) {
    return "rate_limited";
  }
  if (
    raw.includes("INVALID") ||
    raw.includes("PASSWORD") ||
    raw.includes("CREDENTIAL") ||
    raw === "UNAUTHORIZED"
  ) {
    return "invalid_credentials";
  }
  return "sign_in_failed";
}

/** Maps Better Auth secondary flows: only elevates `rate_limited`; otherwise keeps the caller default. */
export function mapBetterAuthSecondaryFailure(input: {
  rawCode?: string | undefined;
  message?: string | undefined;
  defaultCode: AuthErrorCode;
}): AuthErrorCode {
  const raw = (input.rawCode ?? "").toUpperCase().replace(/-/g, "_");
  const msg = (input.message ?? "").toLowerCase();
  if (raw.includes("RATE") || raw.includes("TOO_MANY") || msg.includes("too many")) {
    return "rate_limited";
  }
  if (raw.includes("INVALID_TWO_FACTOR") || raw.includes("TWO_FACTOR_COOKIE")) {
    return "two_factor_session_expired";
  }
  return input.defaultCode;
}

export function isAuthErrorCode(value: string): value is AuthErrorCode {
  return (AUTH_ERROR_CODES as readonly string[]).includes(value);
}

/** Prefer API `code` when it matches our closed set; else fall back by HTTP status. */
export function mapApiServiceFailure(input: {
  status: number;
  apiCode?: string | undefined;
}): AuthErrorCode {
  if (input.apiCode && isAuthErrorCode(input.apiCode)) return input.apiCode;
  if (input.status === 401) return "session_required";
  return "unknown";
}

export function authSubmitFailure(
  code: AuthErrorCode,
  opts?: { registrationDetail?: string | undefined },
): { ok: false; code: AuthErrorCode; message: string } {
  if (code === "registration_validation" && opts?.registrationDetail) {
    return {
      ok: false,
      code,
      message: sanitiseRegistrationDetail(opts.registrationDetail),
    };
  }
  return { ok: false, code, message: AUTH_ERROR_MESSAGES[code] };
}
