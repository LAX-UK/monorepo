import { emailSubjects } from "@auction/branding";
import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.staffEmailChangeConfirm;

/** To the new address: the person must open the link to finish the change LAX client services began. */
export default function StaffEmailChangeConfirmEmail({
  confirmationUrl,
  oldEmail,
  newEmail,
  userName,
  validForDays,
}: TemplateVarsByName["staff-email-change-confirm"]) {
  return (
    <Layout
      category="account"
      eyebrow="Email change"
      header="account"
      preview="Confirm this address to finish moving your LAX Account here."
      title="Confirm your new email address"
    >
      <TextBlock>Hi {userName || newEmail},</TextBlock>
      <TextBlock>
        LAX client services have started moving your LAX Account from {oldEmail} to this address (
        {newEmail}), at your request. Confirm that you can open this inbox to finish the change.
      </TextBlock>
      <Button href={confirmationUrl}>Confirm this address</Button>
      <TextBlock>
        {`The link works for ${validForDays} days. After you confirm, sign in with this address.`}
      </TextBlock>
      <TextBlock>
        If you did not ask for this, ignore this email and nothing will change. You can also write
        to LAX client services and we will look into it.
      </TextBlock>
    </Layout>
  );
}
