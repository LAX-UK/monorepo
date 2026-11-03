import { emailSubjects } from "@auction/branding";
import { SecurityNotice } from "../components/SecurityNotice.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.dataExportRequested;

export default function DataExportRequestedEmail(
  vars: TemplateVarsByName["data-export-requested"],
) {
  return (
    <SecurityNotice
      {...vars}
      preview="A copy of the data LAX holds about you was requested."
      title="A copy of your data was requested"
    >
      <TextBlock>
        A copy of the data LAX holds about you was requested from your LAX Account. We are preparing
        it now and will email you again when it is ready to download from LAX Account.
      </TextBlock>
    </SecurityNotice>
  );
}
