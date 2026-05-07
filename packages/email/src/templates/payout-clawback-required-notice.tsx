import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["payout-clawback-required-notice"]) =>
  `Manual clawback required for ${vars.entityName}`;

export default function PayoutClawbackRequiredNoticeEmail(
  vars: TemplateVarsByName["payout-clawback-required-notice"],
) {
  return (
    <Layout preview={`Manual clawback required for ${vars.entityName}`} title="Manual Clawback Required">
      <TextBlock>Hi {vars.recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        A payout for <strong>{vars.entityName}</strong> has a negative net amount and requires
        manual reconciliation.
      </TextBlock>
      <TextBlock>
        Net amount: {vars.currency} {vars.netAmount}
        <br />
        Payout ID: {vars.payoutId}
      </TextBlock>
      <TextBlock>
        Open the <a href={vars.adminPayoutsUrl}>admin payouts dashboard</a> to resolve it.
      </TextBlock>
    </Layout>
  );
}
