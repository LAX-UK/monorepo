import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["dispute-closed-notice"]) =>
  `Payment dispute ${vars.outcome} for ${vars.entityName}`;

export default function DisputeClosedNoticeEmail(
  vars: TemplateVarsByName["dispute-closed-notice"],
) {
  return (
    <Layout
      category="alert"
      eyebrow="Dispute closed"
      preview={`Payment dispute ${vars.outcome}`}
      title="Payment dispute closed"
    >
      <TextBlock>Hi {vars.recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        A payment dispute for <strong>{vars.entityName}</strong> has closed with outcome{" "}
        <strong>{vars.outcome}</strong>.
      </TextBlock>
      <TextBlock>
        Amount: {vars.currency} {vars.amount}
      </TextBlock>
      <HelpBlock email={vars.supportContactEmail} />
    </Layout>
  );
}
