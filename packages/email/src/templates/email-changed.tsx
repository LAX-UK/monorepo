import { emailSubjects } from "@auction/branding";
import { SecurityNotice } from "../components/SecurityNotice.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.emailChanged;

export default function EmailChangedEmail({
  previousEmail,
  newEmail,
  recipient,
  ...vars
}: TemplateVarsByName["email-changed"]) {
  return (
    <SecurityNotice
      {...vars}
      preview="The email address on your LAX Account was changed."
      title="Email address changed"
      details={[
        { label: "Previous email", value: previousEmail },
        { label: "New email", value: newEmail },
      ]}
    >
      <TextBlock>
        {recipient === "new"
          ? "This address is now the email address for a LAX Account. Sign-in links and security notices will come here."
          : "The email address on your LAX Account was changed. Sign-in links and security notices now go to the new address, and this address no longer signs in to the account."}
      </TextBlock>
    </SecurityNotice>
  );
}
