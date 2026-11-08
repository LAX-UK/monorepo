/** Maps Better Auth social callback ?error= codes to user-facing copy. */
export function socialErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case "access_denied":
      return "Google sign-in was cancelled.";
    case "account_not_linked":
      return "There's already a LAX Account for this email. Sign in the way you usually do.";
    case "staff_social_sign_in_not_allowed":
      return "Staff accounts can't sign in with Google or Apple. Sign in with your email and password.";
    default:
      return "We couldn't sign you in with Google. Try again or use email.";
  }
}
