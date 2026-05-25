/** Map Better Auth OAuth error codes to user-facing copy on /login. */
export function socialErrorMessage(reason: string | null | undefined): string {
  switch (reason?.trim().toLowerCase()) {
    case "account_not_linked":
    case "account_not_found":
      return "This provider account is not linked to a LAX account. Sign in with email first, then connect Google or Apple in settings.";
    case "banned":
    case "user_banned":
      return "This account cannot sign in. Contact support if you believe this is a mistake.";
    case "email_not_verified":
      return "Your email must be verified before linking this provider.";
    case "access_denied":
      return "Sign-in was cancelled or denied at the provider.";
    default:
      return "Could not sign in with that provider.";
  }
}
