import { SITE_SUPPORT_EMAIL, emailSubjects } from "@auction/branding";
import { SecurityNotice } from "../components/SecurityNotice.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.staffEmailChangeStarted;

/** To the address on file: LAX client services began moving the account to a new address. */
export default function StaffEmailChangeNoticeEmail({
  newEmail,
  ...vars
}: TemplateVarsByName["staff-email-change-notice"]) {
  return (
    <SecurityNotice
      {...vars}
      preview="LAX client services are changing the email address on your LAX Account."
      title="Your email address is being changed"
      details={[{ label: "New email", value: newEmail }]}
    >
      <TextBlock>
        At your request, LAX client services are changing the email address on your LAX Account to
        the address below. This happens only after we have checked who is asking. You were signed
        out on every device.
      </TextBlock>
      <TextBlock>
        The change finishes when the link we sent to the new address is opened. Until then, you can
        still sign in with this address. If you did not ask for this, secure your account now and
        write to {SITE_SUPPORT_EMAIL}.
      </TextBlock>
    </SecurityNotice>
  );
}
