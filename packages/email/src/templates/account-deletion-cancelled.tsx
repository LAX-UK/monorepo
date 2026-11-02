import { emailSubjects } from "@auction/branding";
import { SecurityNotice } from "../components/SecurityNotice.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.accountDeletionCancelled;

export default function AccountDeletionCancelledEmail(
  vars: TemplateVarsByName["account-deletion-cancelled"],
) {
  return (
    <SecurityNotice
      {...vars}
      preview="The request to delete your LAX Account was cancelled."
      title="Account deletion cancelled"
    >
      <TextBlock>
        The request to delete your LAX Account was cancelled. Your account and your details stay as
        they were, and nothing will be erased.
      </TextBlock>
    </SecurityNotice>
  );
}
