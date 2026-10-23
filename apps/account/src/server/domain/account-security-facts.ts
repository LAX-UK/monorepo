import type { AccountOverviewVm } from "./account-overview.vm";

/**
 * What Account can state about the person's security, read from the ID token it already holds.
 *
 * Deliberately not here, because the ID token does not carry them and a guess would mislead:
 * whether two-step verification is enrolled when this sign-in did not use it, how many backup
 * codes remain, whether a password is set, and which products the person has used.
 */
export type AccountSecurityFacts = {
  hasEmail: boolean;
  emailVerified: boolean;
  hasPhone: boolean;
  phoneVerified: boolean;
  /**
   * True only when this sign-in completed a second factor, which proves one is enrolled.
   * False means "not confirmed by this sign-in", never "switched off".
   */
  twoStepConfirmed: boolean;
};

export function readAccountSecurityFacts(
  overview: Pick<
    AccountOverviewVm,
    "email" | "emailVerified" | "phone" | "phoneVerified" | "signedInWithAuthenticator"
  >,
): AccountSecurityFacts {
  return {
    hasEmail: overview.email !== null,
    emailVerified: overview.email !== null && overview.emailVerified,
    hasPhone: overview.phone !== null,
    phoneVerified: overview.phoneVerified,
    twoStepConfirmed: overview.signedInWithAuthenticator,
  };
}
