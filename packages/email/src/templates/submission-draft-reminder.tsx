import { emailSubjects } from "@auction/branding";
import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.submissionDraftReminder;

export default function SubmissionDraftReminderEmail({
  userName,
  submissionTitle,
  submissionUrl,
  staleDays,
  unsubscribeUrl,
}: TemplateVarsByName["submission-draft-reminder"]) {
  return (
    <Layout
      category="account"
      eyebrow="Draft reminder"
      preview={`Your draft "${submissionTitle}" is waiting.`}
      title="Resume your submission"
      unsubscribeUrl={unsubscribeUrl}
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        Your draft <strong>{submissionTitle}</strong> has not been updated in {staleDays} days. When
        you are ready, open it to finish and submit for specialist review.
      </TextBlock>
      <Button href={submissionUrl}>Continue submission</Button>
    </Layout>
  );
}
