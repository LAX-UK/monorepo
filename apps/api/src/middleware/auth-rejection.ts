import type { AuthRejectionReason, IAuthenticator } from "../services/interfaces/authenticator.js";

/** The rejection a client can fix with a fresh token, or `null`. Never throws. */
export async function replaceableRejection(
  authenticator: IAuthenticator,
  headers: Headers,
): Promise<AuthRejectionReason | null> {
  try {
    return (await authenticator.diagnoseRejection?.(headers)) ?? null;
  } catch {
    return null;
  }
}
