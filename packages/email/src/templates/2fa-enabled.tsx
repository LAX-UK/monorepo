import { emailSubjects } from "@auction/branding";
import { SecurityNotice } from "../components/SecurityNotice.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.twoFactorEnabled;

export default function TwoFactorEnabledEmail(vars: TemplateVarsByName["2fa-enabled"]) {
  return (
    <SecurityNotice
      {...vars}
      preview="Two-step verification is now on for your LAX Account."
      title="Two-step verification turned on"
    >
      <TextBlock>
        Two-step verification was turned on for your LAX Account. From now on, signing in needs a
        code from your authenticator app as well as your password.
      </TextBlock>
    </SecurityNotice>
  );
}
