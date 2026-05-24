import { emailSubjects } from "@auction/branding";
import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.kycResubmissionRequired;

export default function KycResubmissionRequiredEmail({
  userName,
  issueDetail,
  verifyUrl,
}: TemplateVarsByName["kyc-resubmission-required"]) {
  return (
    <Layout
      category="account"
      eyebrow="Identity verification"
      preview="We need a little more information to finish verifying your identity."
      title="More information needed"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        We could not complete your identity verification yet. Please review the issue below and
        resubmit your documents.
      </TextBlock>
      {issueDetail ? (
        <TextBlock>
          <strong>What to fix:</strong> {issueDetail}
        </TextBlock>
      ) : null}
      <TextBlock>
        Use good lighting, keep your document flat, and make sure your face and ID are fully visible.
      </TextBlock>
      <Button href={verifyUrl}>Continue verification</Button>
    </Layout>
  );
}
