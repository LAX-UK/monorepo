export type SignInNoticeVm = {
  tone: "info" | "error";
  title: string;
  message: string;
};

const NOTICES: Readonly<Record<string, SignInNoticeVm>> = {
  access_denied: {
    tone: "info",
    title: "Sign-in cancelled",
    message: "You didn't finish signing in. Sign in again whenever you're ready.",
  },
  login_required: {
    tone: "info",
    title: "Your sign-in expired",
    message: "Sign in again to keep managing your LAX account.",
  },
  mfa_required: {
    tone: "error",
    title: "Two-step verification needed",
    message:
      "This account needs your authenticator code to continue. Sign in again and complete the second step.",
  },
};

const GENERIC: SignInNoticeVm = {
  tone: "error",
  title: "We couldn't sign you in",
  message: "Something went wrong while signing you in. Please try again.",
};

/** Maps callback `?error=` reasons to copy; unknown reasons get the generic retry message. */
export function signInNotice(reason: string | null | undefined): SignInNoticeVm | null {
  const key = reason?.trim();
  if (!key) return null;
  return NOTICES[key] ?? GENERIC;
}
