import { FactCard } from "../components/FactCard.js";
import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["lot-voided-notice"]) =>
  `Lot voided: ${vars.lotTitle}`;

export default function LotVoidedNoticeEmail(vars: TemplateVarsByName["lot-voided-notice"]) {
  return (
    <Layout
      category="alert"
      eyebrow="Lot voided"
      preview={`Lot voided: ${vars.lotTitle}`}
      title="Lot voided"
    >
      <TextBlock>Hi {vars.recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        <strong>{vars.lotTitle}</strong> has been voided.
      </TextBlock>
      <FactCard rows={[{ label: "Reason", value: vars.reason.replaceAll("_", " ") }]} />
      <HelpBlock email={vars.supportContactEmail} />
    </Layout>
  );
}
