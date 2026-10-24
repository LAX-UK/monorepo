import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["payout-initiated-notice"]) =>
  `Your payout for ${vars.entityName} is on its way`;

export default function PayoutInitiatedNoticeEmail(
  vars: TemplateVarsByName["payout-initiated-notice"],
) {
  return (
    <Layout
      category="finance"
      eyebrow="Payout"
      preview={`A payout for ${vars.entityName} is on its way`}
      title="Your payout is on its way"
    >
      <TextBlock>Hi {vars.recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        We have started a payout for <strong>{vars.entityName}</strong>. It usually reaches your
        bank account within a few working days.
      </TextBlock>
      <FactCard
        rows={[
          { label: "Amount", value: `${vars.currency} ${vars.amount}` },
          { label: "Payout ID", value: vars.payoutId, mono: true },
        ]}
      />
      <Button href={vars.payoutsUrl}>View sold lots and payouts</Button>
    </Layout>
  );
}
