import { emailSubjects } from "@auction/branding";
import { SecurityNotice } from "../components/SecurityNotice.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.twoFactorResetBySupport;

export default function TwoFactorResetBySupportEmail(
  vars: TemplateVarsByName["2fa-reset-by-support"],
) {
  return (
    <SecurityNotice
      {...vars}
      preview="LAX support reset two-step verification on your LAX Account."
      title="Two-step verification reset by LAX support"
    >
      <TextBlock>
        LAX support reset two-step verification on your LAX Account, and every device was signed
        out. This happens only after we have checked it is you. The next time you sign in, use your
        password, then set up two-step verification again from your security settings.
      </TextBlock>
    </SecurityNotice>
  );
}
