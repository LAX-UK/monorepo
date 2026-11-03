export type SignInNoticeVm = {
  tone: "info" | "error";
  title: string;
  message: string;
  /** Whether trying again can help; a suspended account will be refused every time. */
  canRetry: boolean;
  /** Whether to offer the contact page, for problems only the team can fix. */
  offerContact: boolean;
};

const NOTICES: Readonly<Record<string, SignInNoticeVm>> = {
  access_denied: {
    tone: "info",
    title: "Sign-in cancelled",
    message: "You didn't finish signing in. Sign in again whenever you're ready.",
    canRetry: true,
    offerContact: false,
  },
  login_required: {
    tone: "info",
    title: "Your sign-in expired",
    message: "Sign in again to keep managing your LAX Account.",
    canRetry: true,
    offerContact: false,
  },
  mfa_required: {
    tone: "error",
    title: "Two-step verification needed",
    message:
      "This account needs your authenticator code to continue. Sign in again and complete the second step.",
    canRetry: true,
    offerContact: false,
  },
  account_suspended: {
    tone: "error",
    title: "This account is suspended",
    message: "You can't sign in to LAX Account while it is suspended.",
    canRetry: false,
    offerContact: true,
  },
};

const GENERIC: SignInNoticeVm = {
  tone: "error",
  title: "We couldn't sign you in",
  message: "Something went wrong while signing you in. Please try again.",
  canRetry: true,
  offerContact: false,
};

/** Maps callback `?error=` reasons to copy; unknown reasons get the generic retry message. */
export function signInNotice(reason: string | null | undefined): SignInNoticeVm | null {
  const key = reason?.trim();
  if (!key) return null;
  return NOTICES[key] ?? GENERIC;
}
