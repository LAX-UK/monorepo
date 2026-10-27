/**
 * The staff session can no longer be carried forward (the issuer refused the refresh, did not
 * renew the ID token, or could not be reached), so the person has to sign in again. Pages turn it
 * into a sign-in redirect that returns to the same page, never into an error page.
 */
export class StaffSessionEndedError extends Error {
  constructor(
    readonly reason: "refresh_rejected" | "id_token_not_renewed" | "renewal_failed",
    options?: { cause?: unknown },
  ) {
    super(`Staff session ended: ${reason}`, options);
    this.name = "StaffSessionEndedError";
  }
}

export function isStaffSessionEnded(error: unknown): error is StaffSessionEndedError {
  return error instanceof StaffSessionEndedError;
}
