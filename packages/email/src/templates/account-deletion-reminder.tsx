import { emailSubjects } from "@auction/branding";
import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.accountDeletionReminder;

export default function AccountDeletionReminderEmail({
  userName,
  effectiveDateDisplay,
  daysLeft,
  cancelDeletionUrl,
}: TemplateVarsByName["account-deletion-reminder"]) {
  return (
    <Layout
      category="account"
      eyebrow="Security"
      header="account"
      preview={`Your LAX Account will be deleted on ${effectiveDateDisplay} unless you cancel.`}
      title="Your account will be deleted in a week"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        You asked us to delete your LAX Account. In {daysLeft} {daysLeft === 1 ? "day" : "days"}, on{" "}
        {effectiveDateDisplay}, we will permanently erase your name, email address, phone number,
        saved addresses and sign-in details.
      </TextBlock>
      <FactCard rows={[{ label: "Deletion date", value: effectiveDateDisplay }]} />
      <TextBlock>
        If you've changed your mind, sign in and cancel the request. Nothing is lost if you cancel
        before that day.
      </TextBlock>
      <Button href={cancelDeletionUrl}>Cancel deletion</Button>
      <TextBlock>If you still want your account deleted, there's nothing more to do.</TextBlock>
    </Layout>
  );
}
