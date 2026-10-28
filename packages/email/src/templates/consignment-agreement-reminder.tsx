import { emailSubjects } from "@auction/branding";
import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.consignmentAgreementReminder;

export default function ConsignmentAgreementReminderEmail({
  userName,
  submissionTitle,
  submissionUrl,
  unsubscribeUrl,
}: TemplateVarsByName["consignment-agreement-reminder"]) {
  return (
    <Layout
      category="account"
      eyebrow="Consignment update"
      preview={`Your consignment agreement for "${submissionTitle}" is waiting.`}
      title="Your consignment agreement is waiting"
      unsubscribeUrl={unsubscribeUrl}
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        A specialist accepted <strong>{submissionTitle}</strong> and proposed an estimate and terms.
        We can catalogue your work for sale once the consignment agreement is accepted.
      </TextBlock>
      <Button href={submissionUrl}>Review the agreement</Button>
    </Layout>
  );
}
