import { emailSubjects } from "@auction/branding";
import { SecurityNotice } from "../components/SecurityNotice.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.signInMethodRemoved;

export default function SignInMethodRemovedEmail({
  methodLabel,
  detail,
  ...vars
}: TemplateVarsByName["sign-in-method-removed"]) {
  const named = detail ? `${methodLabel} (${detail})` : methodLabel;
  return (
    <SecurityNotice
      {...vars}
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
