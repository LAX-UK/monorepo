export type ShopAdminLoginErrorReason =
  | "mfa_required"
  | "not_authorized"
  | "access_denied"
  | "session_expired"
  | "auth_failed"
  | "missing_pending"
  | "missing_code"
  | "invalid_state"
  | "login_required"
  | string;

export type ShopAdminLoginErrorView = {
  title: string;
  message: string;
  showRetrySignIn: boolean;
  showUseDifferentAccount: boolean;
};

const LOOP_ERRORS = new Set<string>(["mfa_required", "not_authorized"]);

export function shopAdminLoginErrorView(
  reason: ShopAdminLoginErrorReason,
): ShopAdminLoginErrorView {
  switch (reason) {
    case "mfa_required":
      return {
        title: "Authenticator required",
        message:
          "Shop admin requires an authenticator app on your LAX account. Sign in with email and password (not Google-only) to enrol one during sign-in, or ask a shop administrator for help.",
        showRetrySignIn: true,
        showUseDifferentAccount: true,
      };
    case "not_authorized":
      return {
        title: "No shop staff access",
        message: "This account is signed in but does not have permission to use shop admin.",
        showRetrySignIn: false,
        showUseDifferentAccount: true,
      };
    case "access_denied":
      return {
        title: "Sign-in cancelled",
        message: "You cancelled sign-in or denied access.",
        showRetrySignIn: true,
        showUseDifferentAccount: true,
      };
    case "missing_pending":
    case "missing_code":
    case "invalid_state":
    case "session_expired":
      return {
        title: "Sign-in session expired",
        message: "Your sign-in session expired or was interrupted. Start again.",
        showRetrySignIn: true,
        showUseDifferentAccount: false,
      };
    case "login_required":
      return {
        title: "Sign in required",
        message: "Please sign in again to continue.",
        showRetrySignIn: true,
        showUseDifferentAccount: true,
      };
    case "auth_failed":
      return {
        title: "Sign-in failed",
        message: "Something went wrong during sign-in. Try again.",
        showRetrySignIn: true,
        showUseDifferentAccount: false,
      };
    default:
      return {
        title: "Sign-in failed",
        message: "Something went wrong during sign-in. Try again.",
        showRetrySignIn: !LOOP_ERRORS.has(reason),
        showUseDifferentAccount: LOOP_ERRORS.has(reason),
      };
  }
}
