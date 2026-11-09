import { emailSubjects } from "@auction/branding";
import { SecurityNotice } from "../components/SecurityNotice.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.signInMethodRemoved;

const FALLBACK_LABEL = "A sign-in method";

export default function SignInMethodRemovedEmail(
  vars: TemplateVarsByName["sign-in-method-removed"],
) {
  // An email queued before passkeys named the provider as `providerName`.
  const { methodLabel, detail, providerName, ...notice } = vars as typeof vars & {
    providerName?: string;
  };
  const label = methodLabel ?? providerName ?? FALLBACK_LABEL;
  const named = detail ? `${label} (${detail})` : label;
  return (
    <SecurityNotice
      {...notice}
      preview={`${named} was removed as a way to sign in to your LAX Account.`}
      title="A way to sign in was removed"
    >
      <TextBlock>
        {named} was removed from your LAX Account. Every other device was signed out. You can still
        sign in with the methods that remain on your account.
      </TextBlock>
    </SecurityNotice>
  );
}
