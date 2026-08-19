/** Magic-link email template: sign-in copy for established accounts (any linked
 * credential or social account row), activation copy only for truly account-less
 * users (e.g. seeded passwordless imports). */
export type MagicLinkTemplate = "account-activation" | "sign-in-link";

export function pickMagicLinkTemplate(isEstablishedAccount: boolean): MagicLinkTemplate {
  return isEstablishedAccount ? "sign-in-link" : "account-activation";
}
