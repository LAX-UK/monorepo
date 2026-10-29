import type { AccountsUnavailableReason } from "./account-directory";

export const ACCOUNTS_UNAVAILABLE_ERROR_NAME = "AccountsUnavailableError";

/**
 * The digest a page's error boundary receives. Next keeps a thrown error's own `digest` when it
 * sends the error to the browser (and drops the message in production), so this is how a route
 * error boundary knows to show the accounts retry state rather than "Something went wrong".
 */
export const ACCOUNTS_UNAVAILABLE_DIGEST = "LAX_ACCOUNTS_UNAVAILABLE";

/**
 * Thrown by pages that need the acting account when it could not be read. On a full load the
 * client layout shows the retry state for the same request; on a client-side navigation the
 * layout is kept, and the page's error boundary shows it instead. Either way a page never goes on
 * to act, redirect or render as the wrong account.
 */
export class AccountsUnavailableError extends Error {
  readonly reason: AccountsUnavailableReason;
  readonly digest = ACCOUNTS_UNAVAILABLE_DIGEST;

  constructor(reason: AccountsUnavailableReason) {
    super(`[accounts] could not read the signed-in person's accounts (${reason})`);
    this.name = ACCOUNTS_UNAVAILABLE_ERROR_NAME;
    this.reason = reason;
  }
}

/** Whether an error (server-side, or as a route error boundary receives it) is this one. */
export function isAccountsUnavailableError(error: unknown): boolean {
  if (error instanceof AccountsUnavailableError) return true;
  if (!(error instanceof Error)) return false;
  const digest = (error as Error & { digest?: unknown }).digest;
  return error.name === ACCOUNTS_UNAVAILABLE_ERROR_NAME || digest === ACCOUNTS_UNAVAILABLE_DIGEST;
}
