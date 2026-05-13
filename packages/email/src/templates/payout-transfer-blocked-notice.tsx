import { COLORS } from "@auction/branding";
import { Link } from "@react-email/components";
import { FactCard } from "../components/FactCard.js";
import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["payout-transfer-blocked-notice"]) =>
  `Payout blocked for ${vars.entityName}`;

export default function PayoutTransferBlockedNoticeEmail(
  vars: TemplateVarsByName["payout-transfer-blocked-notice"],
) {
  const {
    recipientFirstName,
    entityName,
    payoutId,
    payoutAmount,
    payoutCurrency,
    blockReason,
    supportContactEmail,
    adminPayoutsUrl,
  } = vars;

  return (
    <Layout
      category="alert"
      eyebrow="Payout blocked"
      preview={`Payout blocked for ${entityName}`}
      title="Payout blocked"
    >
      <TextBlock>Hi {recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        A payout for <strong>{entityName}</strong> is ready, but Stripe Connect is not currently
        payout-ready for this organisation.
      </TextBlock>
      <FactCard
        rows={[
          { label: "Amount", value: `${payoutCurrency} ${payoutAmount}` },
          { label: "Payout ID", value: payoutId, mono: true },
          { label: "Reason", value: blockReason },
        ]}
      />
      <TextBlock>
        The payout will stay scheduled until the Connect account can receive payouts. Please review
        the{" "}
        <Link href={adminPayoutsUrl} style={{ color: COLORS.link, textDecoration: "underline" }}>
          admin payouts dashboard
        </Link>{" "}
        and complete any outstanding Stripe Connect requirements.
      </TextBlock>
      <HelpBlock email={supportContactEmail} />
    </Layout>
  );
}
