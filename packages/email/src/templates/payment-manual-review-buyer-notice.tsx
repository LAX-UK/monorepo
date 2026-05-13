import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["payment-manual-review-buyer-notice"]) =>
  `Your winning bid for ${vars.lotTitle} is being reviewed`;

export default function PaymentManualReviewBuyerNoticeEmail(
  vars: TemplateVarsByName["payment-manual-review-buyer-notice"],
) {
  const { userName, lotTitle, lotReference, supportContactEmail } = vars;
  const lotLabel = lotReference ? `${lotTitle} (lot ${lotReference})` : lotTitle;

  return (
    <Layout
      category="alert"
      eyebrow="Payment under review"
      preview={`Your winning bid for ${lotTitle} is being reviewed`}
      title="Payment review"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        Your winning bid for <strong>{lotLabel}</strong> is being reviewed.
      </TextBlock>
      <TextBlock>We&apos;ll confirm the next step within 5 business days.</TextBlock>
      <HelpBlock email={supportContactEmail} />
    </Layout>
  );
}
