import { FactCard } from "../components/FactCard.js";
import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["proxy-cancelled-notice"]) =>
  `Proxy bid cancelled for ${vars.lotTitle}`;

export default function ProxyCancelledNoticeEmail(
  vars: TemplateVarsByName["proxy-cancelled-notice"],
) {
  return (
    <Layout
      category="auction"
      eyebrow="Proxy bid cancelled"
      preview={`Proxy bid cancelled for ${vars.lotTitle}`}
      title="Proxy bid cancelled"
    >
      <TextBlock>Hi {vars.userName || "there"},</TextBlock>
      <TextBlock>
        Your proxy bid for <strong>{vars.lotTitle}</strong> has been cancelled.
      </TextBlock>
      <FactCard rows={[{ label: "Reason", value: vars.reason.replaceAll("_", " ") }]} />
      <HelpBlock email={vars.supportContactEmail} />
    </Layout>
  );
}
