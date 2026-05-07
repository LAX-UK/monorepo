import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["lot-voided-notice"]) =>
  `Lot voided: ${vars.lotTitle}`;

export default function LotVoidedNoticeEmail(vars: TemplateVarsByName["lot-voided-notice"]) {
  return (
    <Layout preview={`Lot voided: ${vars.lotTitle}`} title="Lot Voided">
      <TextBlock>Hi {vars.recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        <strong>{vars.lotTitle}</strong> has been voided.
      </TextBlock>
      <TextBlock>Reason: {vars.reason.replaceAll("_", " ")}</TextBlock>
      <TextBlock>
        If you have questions, contact{" "}
        <a href={`mailto:${vars.supportContactEmail}`}>{vars.supportContactEmail}</a>.
      </TextBlock>
    </Layout>
  );
}
