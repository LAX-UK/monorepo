import { SITE_SUPPORT_EMAIL, emailSubjects } from "@auction/branding";
import { SecurityNotice } from "../components/SecurityNotice.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.staffEmailChangeCancelled;

/** To the address on file: LAX staff cancelled a pending change of the account's email address. */
export default function StaffEmailChangeCancelledNoticeEmail(
  vars: TemplateVarsByName["staff-email-change-cancelled-notice"],
) {
  return (
    <SecurityNotice
      {...vars}
      preview="A pending change of your LAX Account email address was cancelled by LAX staff."
      title="Your email address change was cancelled"
    >
      <TextBlock>
        A pending change of your email address was cancelled by LAX staff. Your account keeps the
        address it has now, and the link we sent to the other address no longer works.
      </TextBlock>
      <TextBlock>
        Any devices we signed out when the change began stay signed out, so sign in again to
        continue. If you did not expect this, secure your account now and write to{" "}
        {SITE_SUPPORT_EMAIL}.
      </TextBlock>
    </SecurityNotice>
  );
}
