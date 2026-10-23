import { emailSubjects } from "@auction/branding";
import { SecurityNotice } from "../components/SecurityNotice.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.twoFactorDisabled;

export default function TwoFactorDisabledEmail(vars: TemplateVarsByName["2fa-disabled"]) {
  return (
    <SecurityNotice
      {...vars}
      preview="Two-step verification was turned off for your LAX Account."
      title="Two-step verification turned off"
    >
      <TextBlock>
        Two-step verification was turned off for your LAX Account. Your account is now protected by
        your password alone. You can turn it back on at any time from your security settings.
      </TextBlock>
    </SecurityNotice>
  );
}
