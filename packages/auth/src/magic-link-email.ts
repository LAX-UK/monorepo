import type { TemplateName } from "@auction/email";

/** Magic-link email template: sign-in copy for established accounts (any linked
 * credential or social account row), activation copy only for truly account-less
 * users (e.g. seeded passwordless imports). */
export function pickMagicLinkTemplate(
  isEstablishedAccount: boolean,
): Extract<TemplateName, "account-activation" | "sign-in-link"> {
  return isEstablishedAccount ? "sign-in-link" : "account-activation";
}
