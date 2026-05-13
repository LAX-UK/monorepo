import { COLORS } from "@auction/branding";
import { Link } from "@react-email/components";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["payout-clawback-required-notice"]) =>
  `Manual clawback required for ${vars.entityName}`;

export default function PayoutClawbackRequiredNoticeEmail(
  vars: TemplateVarsByName["payout-clawback-required-notice"],
) {
  return (
    <Layout
      category="alert"
      eyebrow="Manual clawback"
      preview={`Manual clawback required for ${vars.entityName}`}
      title="Manual clawback required"
    >
      <TextBlock>Hi {vars.recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        A payout for <strong>{vars.entityName}</strong> has a negative net amount and requires
        manual reconciliation.
      </TextBlock>
      <FactCard
        rows={[
          { label: "Net amount", value: `${vars.currency} ${vars.netAmount}` },
          { label: "Payout ID", value: vars.payoutId, mono: true },
        ]}
      />
      <TextBlock>
        Open the{" "}
        <Link
          href={vars.adminPayoutsUrl}
          style={{ color: COLORS.link, textDecoration: "underline" }}
        >
          admin payouts dashboard
        </Link>{" "}
        to resolve it.
      </TextBlock>
    </Layout>
  );
}
