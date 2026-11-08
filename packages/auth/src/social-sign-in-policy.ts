/**
 * What a Google or Apple sign-in may do to an account that already exists. Pure decisions, so
 * the rules are read and tested as tables; the Better Auth hooks only gather the facts and obey.
 *
 * A provider proves who is signing in, nothing more. It is never a second step (SM13), staff
 * accounts do not use it at all (SM14), and it never joins an account that chose stronger
 * protection without that person's say-so (SM4).
 */

export const SOCIAL_PROVIDER_IDS = ["google", "apple"] as const;
export type SocialProviderId = (typeof SOCIAL_PROVIDER_IDS)[number];

export function isSocialProviderId(providerId: string): providerId is SocialProviderId {
  return (SOCIAL_PROVIDER_IDS as readonly string[]).includes(providerId);
}

/** The error codes a refused social sign-in or link returns to the hosted page. */
export const SOCIAL_SIGN_IN_ERROR_CODES = {
  /** An account with this email exists and the provider may not be joined to it silently. */
  accountNotLinked: "account_not_linked",
  /** The account is a staff account; staff sign in with a password and two-step verification. */
  staffNotAllowed: "staff_social_sign_in_not_allowed",
} as const;

/** What is known about the existing LAX account a provider sign-in meets. */
export type SocialSubject = {
  /** Holds a staff access marker in LAX Bid or LAX Admin. */
  isStaff: boolean;
  /** Two-step verification (authenticator app or backup codes) is switched on. */
  twoFactorEnabled: boolean;
  /** The account's own email address was confirmed. */
  emailVerified: boolean;
};

/** SM14: a staff account never signs in, links or is linked with Google or Apple. */
export function mayUseSocialSignIn(subject: Pick<SocialSubject, "isStaff">): boolean {
  return !subject.isStaff;
}

export type ImplicitLinkBlockReason = "staff" | "two_step";

export type ImplicitLinkDecision =
  /** Both addresses are confirmed and nothing stronger was chosen: join the provider. */
  | { kind: "link" }
  /**
   * SM5: the account's email was never confirmed and the provider has just proved it. Join the
   * provider, confirm the email, and drop any password set before that proof (it may have been
   * set by whoever registered the address first).
   */
  | { kind: "link_and_secure" }
  /** Do not join: the person signs in the usual way and links the provider from Security. */
  | { kind: "block"; reason: ImplicitLinkBlockReason };

/**
 * SM4: a provider that returns the email of an existing account is joined to it only when that is
 * safe. The provider's own email must already be verified (Better Auth refuses otherwise, since
 * no provider is trusted without it). Staff accounts and accounts with two-step verification on
 * are never joined this way.
 */
export function decideImplicitLink(subject: SocialSubject): ImplicitLinkDecision {
  if (!mayUseSocialSignIn(subject)) return { kind: "block", reason: "staff" };
  if (subject.twoFactorEnabled) return { kind: "block", reason: "two_step" };
  return subject.emailVerified ? { kind: "link" } : { kind: "link_and_secure" };
}
