import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["payout-initiated-notice"]) =>
  `Payout initiated for ${vars.entityName}`;

export default function PayoutInitiatedNoticeEmail(vars: TemplateVarsByName["payout-initiated-notice"]) {
  return (
    <Layout preview={`Payout initiated for ${vars.entityName}`} title="Payout Initiated">
      <TextBlock>Hi {vars.recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        A payout for <strong>{vars.entityName}</strong> has been initiated.
      </TextBlock>
      <TextBlock>
        Amount: {vars.currency} {vars.amount}
        <br />
        Payout ID: {vars.payoutId}
      </TextBlock>
      <TextBlock>
        You can review it in the <a href={vars.adminPayoutsUrl}>admin payouts dashboard</a>.
      </TextBlock>
    </Layout>
  );
}
