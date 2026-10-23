import { emailSubjects } from "@auction/branding";
import { SecurityNotice } from "../components/SecurityNotice.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.backupCodesRegenerated;

export default function BackupCodesRegeneratedEmail(
  vars: TemplateVarsByName["backup-codes-regenerated"],
) {
  return (
    <SecurityNotice
      {...vars}
      preview="New backup codes were created for your LAX Account."
      title="New backup codes created"
    >
      <TextBlock>
        A new set of backup codes was created for your LAX Account. Your old backup codes no longer
        work.
      </TextBlock>
    </SecurityNotice>
  );
}
