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
        Your submission <strong>{submissionTitle}</strong> was accepted for cataloguing. Our
        specialists are preparing your catalogue entry.
      </TextBlock>
      <Button href={submissionUrl}>View submission</Button>
    </Layout>
  );
}
