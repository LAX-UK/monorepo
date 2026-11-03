import { emailSubjects } from "@auction/branding";
import { SecurityNotice } from "../components/SecurityNotice.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.signInMethodRemoved;

export default function SignInMethodRemovedEmail({
  providerName,
  ...vars
}: TemplateVarsByName["sign-in-method-removed"]) {
  return (
    <SecurityNotice
      {...vars}
      preview={`${providerName} sign-in was removed from your LAX Account.`}
      title={`${providerName} sign-in removed`}
    >
      <TextBlock>
        Signing in with {providerName} was removed from your LAX Account. Every other device was
        signed out. You can still sign in with the methods that remain on your account.
      </TextBlock>
    </SecurityNotice>
  );
}
