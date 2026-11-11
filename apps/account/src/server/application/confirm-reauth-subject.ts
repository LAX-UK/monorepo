import type { PendingAccountLogin } from "./start-account-login";

/**
 * A "Confirm it's you" sign-in may only unlock a sensitive change for the person who asked for
 * it. The issuer's page fixes the email for a password, but a passkey is discoverable and names
 * nobody, so whoever the passkey belongs to is who comes back: that subject must be the one that
 * sent the browser there. Fails closed: a step-up that does not say who asked is refused.
 */
export function assertReauthSubject(pending: PendingAccountLogin, returnedSubject: string): void {
  if (!pending.reauth) return;
  if (!pending.reauthSubject || pending.reauthSubject !== returnedSubject) {
    throw new Error("Step-up sign-in was not completed by the person who asked for it");
  }
}
