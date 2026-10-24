import { FactCard } from "../components/FactCard.js";
import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["lot-withdrawal-declined-notice"]) =>
  `Withdrawal request declined: ${vars.lotTitle}`;

export default function LotWithdrawalDeclinedNoticeEmail(
  vars: TemplateVarsByName["lot-withdrawal-declined-notice"],
) {
  return (
    <Layout
      category="alert"
      eyebrow="Withdrawal request"
      preview={`Your request to withdraw ${vars.lotTitle} was declined.`}
      title="Withdrawal request declined"
    >
      <TextBlock>Hi {vars.recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        We have declined the request to withdraw <strong>{vars.lotTitle}</strong>. The lot stays as
        it is.
      </TextBlock>
      <FactCard rows={[{ label: "Reason", value: vars.reason }]} />
      <HelpBlock email={vars.supportContactEmail} />
    </Layout>
  );
}
