import { saleCancelledConsequence } from "@auction/branding";
import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["sale-cancelled-notice"]) =>
  `${vars.saleTitle} has been cancelled`;

export default function SaleCancelledNoticeEmail(
  vars: TemplateVarsByName["sale-cancelled-notice"],
) {
  return (
    <Layout
      category="auction"
      eyebrow="Sale cancelled"
      preview={`${vars.saleTitle} has been cancelled.`}
      title="This sale has been cancelled"
    >
      <TextBlock>Hi {vars.userName || "there"},</TextBlock>
      <TextBlock>
        The sale <strong>{vars.saleTitle}</strong> has been cancelled.{" "}
        {saleCancelledConsequence(vars.audience)}
      </TextBlock>
      <HelpBlock email={vars.supportContactEmail} />
    </Layout>
  );
}
