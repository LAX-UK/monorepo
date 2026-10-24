import { COLORS } from "@auction/branding";
import { Link } from "@react-email/components";
import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["payout-clawback-required-notice"]) =>
  vars.audience === "staff"
    ? `Manual clawback required for ${vars.entityName}`
    : `A payout for ${vars.entityName} needs reconciling`;

export default function PayoutClawbackRequiredNoticeEmail(
  vars: TemplateVarsByName["payout-clawback-required-notice"],
) {
  if (vars.audience === "staff") {
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
          <Link href={vars.payoutsUrl} style={{ color: COLORS.link, textDecoration: "underline" }}>
            admin payouts dashboard
          </Link>{" "}
          to resolve it.
        </TextBlock>
      </Layout>
    );
  }

  return (
    <Layout
      category="alert"
      eyebrow="Payout"
      preview={`A payout for ${vars.entityName} needs reconciling`}
      title="A payout needs reconciling"
    >
      <TextBlock>Hi {vars.recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        Refunds or adjustments on recent sales mean a payout for <strong>{vars.entityName}</strong>{" "}
        comes to less than zero. Nothing is due from you right now; our team will reconcile it and
        will be in touch if we need anything from you.
      </TextBlock>
      <FactCard
        rows={[
          { label: "Net amount", value: `${vars.currency} ${vars.netAmount}` },
          { label: "Payout ID", value: vars.payoutId, mono: true },
        ]}
      />
      <Button href={vars.payoutsUrl}>View sold lots and payouts</Button>
    </Layout>
  );
}
