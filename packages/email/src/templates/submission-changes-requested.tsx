import { emailSubjects } from "@auction/branding";
import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.submissionChangesRequested;

export default function SubmissionChangesRequestedEmail({
  userName,
  submissionTitle,
  submissionUrl,
  note,
  unsubscribeUrl,
}: TemplateVarsByName["submission-changes-requested"]) {
  return (
    <Layout
      category="account"
      eyebrow="Consignment update"
      preview={`A specialist asked for changes to "${submissionTitle}".`}
      title="Your submission needs changes"
      unsubscribeUrl={unsubscribeUrl}
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        A specialist reviewed <strong>{submissionTitle}</strong> and needs a little more from you
        before deciding.
      </TextBlock>
      {note ? (
        <TextBlock>
          <strong>What to change:</strong> {note}
        </TextBlock>
      ) : null}
      <TextBlock>
        Edit the same submission and send it back. It keeps its place and its history.
      </TextBlock>
      <Button href={submissionUrl}>Make the changes</Button>
    </Layout>
  );
}
