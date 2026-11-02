import { Button } from "../components/Button.js";
import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["payment-failed-notice"]) =>
  `Your payment for ${vars.lotTitle} did not go through`;

export default function PaymentFailedNoticeEmail(
  vars: TemplateVarsByName["payment-failed-notice"],
) {
  return (
    <Layout
      category="alert"
      eyebrow="Payment not completed"
      preview={`Your payment for ${vars.lotTitle} did not go through.`}
      title="Your payment did not go through"
    >
      <TextBlock>Hi {vars.userName || "there"},</TextBlock>
      <TextBlock>
        Your bank did not complete the payment for <strong>{vars.lotTitle}</strong>, so the lot is
        still waiting to be paid for. No payment was taken for this attempt.
      </TextBlock>
      <TextBlock>
        You can try again from checkout, using the same or a different payment method.
      </TextBlock>
      <Button href={vars.payUrl}>Pay again</Button>
      <HelpBlock email={vars.supportContactEmail} />
    </Layout>
  );
}
