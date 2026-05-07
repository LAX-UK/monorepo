import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["proxy-cancelled-notice"]) =>
  `Proxy bid cancelled for ${vars.lotTitle}`;

export default function ProxyCancelledNoticeEmail(vars: TemplateVarsByName["proxy-cancelled-notice"]) {
  return (
    <Layout preview={`Proxy bid cancelled for ${vars.lotTitle}`} title="Proxy Bid Cancelled">
      <TextBlock>Hi {vars.userName || "there"},</TextBlock>
      <TextBlock>
        Your proxy bid for <strong>{vars.lotTitle}</strong> has been cancelled.
      </TextBlock>
      <TextBlock>Reason: {vars.reason.replaceAll("_", " ")}</TextBlock>
      <TextBlock>
        If you have questions, contact <a href={`mailto:${vars.supportContactEmail}`}>{vars.supportContactEmail}</a>.
      </TextBlock>
    </Layout>
  );
}
