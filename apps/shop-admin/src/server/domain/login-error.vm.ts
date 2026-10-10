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
  | "token_exchange_failed"
  | "identity_unavailable"
  | "invalid_id_token"
  | "session_unavailable"
  | string;

export type ShopAdminLoginErrorView = {
  title: string;
  message: string;
  /** Short support reference so staff can report the exact failure. */
  code: string;
  showRetrySignIn: boolean;
  showUseDifferentAccount: boolean;
};

const LOOP_ERRORS = new Set<string>(["mfa_required", "not_authorized"]);

export function shopAdminLoginErrorView(
  reason: ShopAdminLoginErrorReason,
): ShopAdminLoginErrorView {
  const code = reason;
  switch (reason) {
    case "mfa_required":
      return {
        code,
        title: "Authenticator app required",
        message:
          "Shop admin needs two-step verification with an authenticator app. Sign in with your email and password; you’ll be asked to set up or enter your authenticator code. Accounts that only use Google or Apple sign-in can’t enrol one yet — ask a shop administrator for help.",
        showRetrySignIn: true,
        showUseDifferentAccount: true,
      };
    case "not_authorized":
      return {
        code,
        title: "No shop staff access",
        message:
          "You’re signed in, but this LAX account hasn’t been granted shop admin access. Ask a shop administrator to add you, or switch to your staff account.",
        showRetrySignIn: false,
        showUseDifferentAccount: true,
      };
    case "access_denied":
      return {
        code,
        title: "Sign-in cancelled",
        message: "You cancelled sign-in or didn’t grant access to shop admin.",
        showRetrySignIn: true,
        showUseDifferentAccount: true,
      };
    case "missing_pending":
    case "missing_code":
    case "invalid_state":
    case "session_expired":
      return {
        code,
        title: "Sign-in timed out",
        message:
          "Your sign-in took too long or was opened in another tab, so we couldn’t finish it. Start again.",
        showRetrySignIn: true,
        showUseDifferentAccount: false,
      };
    case "login_required":
      return {
        code,
        title: "Sign in required",
        message: "Your LAX session ended. Sign in again to continue.",
        showRetrySignIn: true,
        showUseDifferentAccount: true,
      };
    case "identity_unavailable":
      return {
        code,
        title: "LAX sign-in is temporarily unavailable",
        message:
          "We couldn’t reach the LAX sign-in service to finish signing you in. Wait a moment and try again.",
        showRetrySignIn: true,
        showUseDifferentAccount: false,
      };
    case "token_exchange_failed":
      return {
        code,
        title: "Sign-in couldn’t be completed",
        message:
          "LAX sign-in rejected the request to finish your sign-in. This usually clears up if you start again; if it keeps happening, contact support with the reference below.",
        showRetrySignIn: true,
        showUseDifferentAccount: false,
      };
    case "invalid_id_token":
      return {
        code,
        title: "Sign-in couldn’t be verified",
        message:
          "We couldn’t verify the sign-in response from LAX. Start again; if it keeps happening, contact support with the reference below.",
        showRetrySignIn: true,
        showUseDifferentAccount: false,
      };
    case "session_unavailable":
      return {
        code,
        title: "Shop admin couldn’t start your session",
        message:
          "You signed in successfully, but shop admin couldn’t save your session. Try again in a moment.",
        showRetrySignIn: true,
        showUseDifferentAccount: false,
      };
    default:
      return {
        code: code === "auth_failed" ? code : "unknown",
        title: "Sign-in failed",
        message:
          "We couldn’t finish signing you in. Try again; if it keeps happening, contact support with the reference below.",
        showRetrySignIn: !LOOP_ERRORS.has(reason),
        showUseDifferentAccount: LOOP_ERRORS.has(reason),
      };
  }
}
