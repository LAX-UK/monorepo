import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["dispute-opened-notice"]) =>
  `Payment dispute opened for ${vars.entityName}`;

export default function DisputeOpenedNoticeEmail(vars: TemplateVarsByName["dispute-opened-notice"]) {
  return (
    <Layout preview={`Payment dispute opened for ${vars.entityName}`} title="Payment Dispute Opened">
      <TextBlock>Hi {vars.recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        A buyer has opened a payment dispute affecting <strong>{vars.entityName}</strong>.
      </TextBlock>
      <TextBlock>
        Amount: {vars.currency} {vars.amount}
        <br />
        Reason: {vars.reason || "Not provided"}
      </TextBlock>
      <TextBlock>
        If you have questions, contact <a href={`mailto:${vars.supportContactEmail}`}>{vars.supportContactEmail}</a>.
      </TextBlock>
    </Layout>
  );
}
