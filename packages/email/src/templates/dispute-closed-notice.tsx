import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["dispute-closed-notice"]) =>
  `Payment dispute ${vars.outcome} for ${vars.entityName}`;

export default function DisputeClosedNoticeEmail(vars: TemplateVarsByName["dispute-closed-notice"]) {
  return (
    <Layout preview={`Payment dispute ${vars.outcome}`} title="Payment Dispute Closed">
      <TextBlock>Hi {vars.recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        A payment dispute for <strong>{vars.entityName}</strong> has closed with outcome{" "}
        <strong>{vars.outcome}</strong>.
      </TextBlock>
      <TextBlock>
        Amount: {vars.currency} {vars.amount}
      </TextBlock>
      <TextBlock>
        If you have questions, contact <a href={`mailto:${vars.supportContactEmail}`}>{vars.supportContactEmail}</a>.
      </TextBlock>
    </Layout>
  );
}
