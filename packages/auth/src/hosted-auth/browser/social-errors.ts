/** Maps Better Auth social callback ?error= codes to user-facing copy. */
export function socialErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  switch (code) {
    case "access_denied":
      return "Google sign-in was cancelled.";
    case "account_not_linked":
      return "This email already has a LAX account. Sign in with your password, then connect Google in settings.";
    default:
      return "We couldn't sign you in with Google. Try again or use email.";
  }
}
