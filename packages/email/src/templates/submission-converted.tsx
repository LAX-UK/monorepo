import { emailSubjects } from "@auction/branding";
import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.submissionConverted;

export default function SubmissionConvertedEmail({
  userName,
  submissionTitle,
  submissionUrl,
  unsubscribeUrl,
}: TemplateVarsByName["submission-converted"]) {
  return (
    <Layout
      category="account"
      eyebrow="Consignment update"
      preview={`A draft lot was created for "${submissionTitle}".`}
      title="Draft lot created"
      unsubscribeUrl={unsubscribeUrl}
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        A draft catalogue lot was created for <strong>{submissionTitle}</strong>. Complete any
        remaining steps in your seller dashboard when you are ready.
      </TextBlock>
      <Button href={submissionUrl}>View submission</Button>
    </Layout>
  );
}
