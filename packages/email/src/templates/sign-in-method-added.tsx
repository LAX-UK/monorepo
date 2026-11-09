import { emailSubjects } from "@auction/branding";
import { SecurityNotice } from "../components/SecurityNotice.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.signInMethodAdded;

export default function SignInMethodAddedEmail({
  methodLabel,
  detail,
  ...vars
}: TemplateVarsByName["sign-in-method-added"]) {
  const named = detail ? `${methodLabel} (${detail})` : methodLabel;
  return (
    <SecurityNotice
      {...vars}
      preview={`${named} was added as a way to sign in to your LAX Account.`}
      title="A way to sign in was added"
    >
      <TextBlock>
        {named} was added to your LAX Account. You can now use it to sign in, alongside the methods
        you already had.
      </TextBlock>
    </SecurityNotice>
  );
}
