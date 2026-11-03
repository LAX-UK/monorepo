import { COLORS, KYC_DECLINED_COPY, emailSubjects } from "@auction/branding";
import { Link } from "@react-email/components";
import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = emailSubjects.kycDeclined;

export default function KycDeclinedEmail({
  userName,
  retryUrl,
  contactUrl,
}: TemplateVarsByName["kyc-declined"]) {
  return (
    <Layout
      category="account"
      eyebrow="Identity verification"
      preview={KYC_DECLINED_COPY.headline}
      title={KYC_DECLINED_COPY.headline}
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>{KYC_DECLINED_COPY.detail}</TextBlock>
      <Button href={retryUrl}>{KYC_DECLINED_COPY.retryLabel}</Button>
      <TextBlock>
        Need a hand?{" "}
        <Link href={contactUrl} style={{ color: COLORS.link, textDecoration: "underline" }}>
          {KYC_DECLINED_COPY.contactLabel}
        </Link>
        .
      </TextBlock>
    </Layout>
  );
}
