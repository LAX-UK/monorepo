import type { TemplateName } from "@auction/email";

/** Magic-link email template: activation copy for passwordless users, sign-in copy when a password exists. */
export function pickMagicLinkTemplate(
  hasPassword: boolean,
): Extract<TemplateName, "account-activation" | "sign-in-link"> {
  return hasPassword ? "sign-in-link" : "account-activation";
}
