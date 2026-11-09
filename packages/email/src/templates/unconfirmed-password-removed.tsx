import { emailSubjects } from "@auction/branding";
import { SecurityNotice } from "../components/SecurityNotice.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.unconfirmedPasswordRemoved;

export default function UnconfirmedPasswordRemovedEmail({
  providerName,
  ...vars
}: TemplateVarsByName["unconfirmed-password-removed"]) {
  return (
    <SecurityNotice
      {...vars}
      preview="We removed a password that was set before your email was confirmed."
      title="We secured your LAX Account"
    >
      <TextBlock>
        You signed in with {providerName} and confirmed your email. Before that, a password had been
        set on this account without the email being confirmed, so we removed it and signed out every
        other device.
      </TextBlock>
      <TextBlock>Set a new password in Security if you'd like one.</TextBlock>
    </SecurityNotice>
  );
}
