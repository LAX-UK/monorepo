import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["lot-voided-anti-shilling-admin"]) =>
  `Lot voided at close (anti-shilling): ${vars.lotTitle}`;

export default function LotVoidedAntiShillingAdminEmail(
  vars: TemplateVarsByName["lot-voided-anti-shilling-admin"],
) {
  const { lotTitle, lotId, adminLotUrl, supportContactEmail } = vars;
  return (
    <Layout preview="Lot voided — anti-shilling at close" title="Lot voided at close">
      <TextBlock>A lot was voided at auction end after anti-shilling checks left no eligible winner.</TextBlock>
      <TextBlock>
        <strong>{lotTitle}</strong>
        <br />
        Lot ID: {lotId}
      </TextBlock>
      <TextBlock>
        <a href={adminLotUrl}>Review in admin</a>
      </TextBlock>
      <TextBlock>
        Questions? <a href={`mailto:${supportContactEmail}`}>{supportContactEmail}</a>
      </TextBlock>
    </Layout>
  );
}
