import { emailSubjects } from "@auction/branding";
import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.submissionRejected;

export default function SubmissionRejectedEmail({
  userName,
  submissionTitle,
  submissionUrl,
  resubmitUrl,
  reasonSummary,
  unsubscribeUrl,
}: TemplateVarsByName["submission-rejected"]) {
  return (
    <Layout
      category="account"
      eyebrow="Consignment update"
      preview={`Update on your submission "${submissionTitle}".`}
      title="Submission not accepted"
      unsubscribeUrl={unsubscribeUrl}
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        We were unable to accept <strong>{submissionTitle}</strong> at this time.
      </TextBlock>
      {reasonSummary ? (
        <TextBlock>
          <strong>Reason:</strong> {reasonSummary}
        </TextBlock>
      ) : null}
      <TextBlock>
        You can submit a new item with updated information and our team will review it again.
      </TextBlock>
      <Button href={resubmitUrl}>Submit again</Button>
      <TextBlock>
        <a href={submissionUrl}>View submission details</a>
      </TextBlock>
    </Layout>
  );
}
