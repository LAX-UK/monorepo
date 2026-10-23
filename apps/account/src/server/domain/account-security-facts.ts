import type { AccountSecurityFactsResponse, AccountSession } from "@auction/identity-contracts";
import type { AccountOverviewVm } from "./account-overview.vm";

/**
 * "unknown" is what Account says when the issuer could not be asked and this sign-in did not
 * use a second factor. It is never shown as "off": absence of proof is not proof of absence.
 */
export type TwoStepState = "on" | "off" | "unknown";

/** At or below this many unused backup codes, Account suggests creating a fresh set. */
export const LOW_BACKUP_CODES_THRESHOLD = 3;

/** What Account can state about the person's security. */
export type AccountSecurityFacts = {
  hasEmail: boolean;
  emailVerified: boolean;
  twoStep: TwoStepState;
  /** Unused backup codes; null whenever the issuer did not say, which is not the same as none. */
  backupCodesRemaining: number | null;
  /** Devices signed in besides this one; null whenever the issuer did not say. */
  otherSessionCount: number | null;
};

/**
 * Combines the ID token (email, as of sign-in) with the issuer's live answers about two-step
 * verification and signed-in devices. When the live two-step answer is missing, a second factor
 * used by this very sign-in still proves enrolment; anything else stays unknown.
 */
export function readAccountSecurityFacts(
  overview: Pick<AccountOverviewVm, "email" | "emailVerified" | "signedInWithAuthenticator">,
  live: AccountSecurityFactsResponse | null,
  sessions: readonly AccountSession[] | null = null,
): AccountSecurityFacts {
  const twoStep: TwoStepState = live
    ? live.twoFactorEnabled
      ? "on"
      : "off"
    : overview.signedInWithAuthenticator
      ? "on"
      : "unknown";
  return {
    hasEmail: overview.email !== null,
    emailVerified: overview.email !== null && overview.emailVerified,
    twoStep,
    backupCodesRemaining: live?.twoFactorEnabled ? live.backupCodesRemaining : null,
    otherSessionCount: sessions ? sessions.filter((session) => !session.isCurrent).length : null,
  };
}
