import { emailSubjects } from "@auction/branding";
import { SecurityNotice } from "../components/SecurityNotice.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.passwordChanged;

export default function PasswordChanged(vars: TemplateVarsByName["password-changed"]) {
  return (
    <SecurityNotice
      {...vars}
      preview="Your LAX Account password was changed."
      title="Password changed"
    >
      <TextBlock>
        The password for your LAX Account was changed. It signs you in to LAX Bid, LAX Shop and
        lax.art.
      </TextBlock>
    </SecurityNotice>
  );
}
