import { COLORS } from "@auction/branding";
import { Link } from "@react-email/components";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["payout-initiated-notice"]) =>
  `Payout initiated for ${vars.entityName}`;

export default function PayoutInitiatedNoticeEmail(
  vars: TemplateVarsByName["payout-initiated-notice"],
) {
  return (
    <Layout
      category="finance"
      eyebrow="Payout"
      preview={`Payout initiated for ${vars.entityName}`}
      title="Payout initiated"
    >
      <TextBlock>Hi {vars.recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        A payout for <strong>{vars.entityName}</strong> has been initiated.
      </TextBlock>
      <FactCard
        rows={[
          { label: "Amount", value: `${vars.currency} ${vars.amount}` },
          { label: "Payout ID", value: vars.payoutId, mono: true },
        ]}
      />
      <TextBlock>
        You can review it in the{" "}
        <Link
          href={vars.adminPayoutsUrl}
          style={{ color: COLORS.link, textDecoration: "underline" }}
        >
          admin payouts dashboard
        </Link>
        .
      </TextBlock>
    </Layout>
  );
}
