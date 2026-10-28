import { emailSubjects } from "@auction/branding";
import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.submissionApproved;

export default function SubmissionApprovedEmail({
  userName,
  submissionTitle,
  submissionUrl,
  unsubscribeUrl,
}: TemplateVarsByName["submission-approved"]) {
  return (
    <Layout
      category="account"
      eyebrow="Consignment update"
      preview={`Your submission "${submissionTitle}" was accepted.`}
      title="Submission accepted"
      unsubscribeUrl={unsubscribeUrl}
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        A specialist accepted <strong>{submissionTitle}</strong> and proposed an estimate and terms.
        Read and accept the consignment agreement so we can catalogue your work for sale.
      </TextBlock>
      <Button href={submissionUrl}>Review the agreement</Button>
    </Layout>
  );
}
