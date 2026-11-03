import { KYC_APPROVED_COPY, emailSubjects } from "@auction/branding";
import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.kycApproved;

export default function KycApprovedEmail({
  userName,
  registerUrl,
}: TemplateVarsByName["kyc-approved"]) {
  return (
    <Layout
      category="account"
      eyebrow="Identity verification"
      preview={KYC_APPROVED_COPY.detail}
      title={KYC_APPROVED_COPY.headline}
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        We have checked your identity and you are verified. You only need to do this once.{" "}
        {KYC_APPROVED_COPY.detail}
      </TextBlock>
      <Button href={registerUrl}>{KYC_APPROVED_COPY.actionLabel}</Button>
    </Layout>
  );
}
