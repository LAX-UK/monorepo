import { COLORS } from "@auction/branding";
import { Link } from "@react-email/components";
import { FactCard } from "../components/FactCard.js";
import { HelpBlock } from "../components/HelpBlock.js";
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
    <Layout
      category="alert"
      eyebrow="Admin · lot voided"
      preview="Lot voided — anti-shilling at close"
      title="Lot voided at close"
    >
      <TextBlock>
        A lot was voided at auction end after anti-shilling checks left no eligible winner.
      </TextBlock>
      <FactCard
        rows={[
          { label: "Lot", value: lotTitle },
          { label: "Lot ID", value: lotId, mono: true },
        ]}
      />
      <TextBlock>
        <Link href={adminLotUrl} style={{ color: COLORS.link, textDecoration: "underline" }}>
          Review in admin
        </Link>
      </TextBlock>
      <HelpBlock email={supportContactEmail} />
    </Layout>
  );
}
