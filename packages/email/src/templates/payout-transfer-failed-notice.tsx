import { COLORS } from "@auction/branding";
import { Link } from "@react-email/components";
import { FactCard } from "../components/FactCard.js";
import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["payout-transfer-failed-notice"]) =>
  `Payout transfer failed for ${vars.entityName}`;

export default function PayoutTransferFailedNoticeEmail(
  vars: TemplateVarsByName["payout-transfer-failed-notice"],
) {
  const {
    recipientFirstName,
    entityName,
    payoutId,
    payoutAmount,
    payoutCurrency,
    failureReason,
    supportContactEmail,
    adminPayoutsUrl,
    sellerPayoutSetupUrl,
  } = vars;

  return (
    <Layout
      category="alert"
      eyebrow="Payout failed"
      preview={`Payout transfer failed for ${entityName}`}
      title="Payout transfer failed"
    >
      <TextBlock>Hi {recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        A payout transfer for <strong>{entityName}</strong> could not be completed.
      </TextBlock>
      <FactCard
        rows={[
          { label: "Amount", value: `${payoutCurrency} ${payoutAmount}` },
          { label: "Payout ID", value: payoutId, mono: true },
          { label: "Failure reason", value: failureReason },
        ]}
      />
      <TextBlock>
        This payout requires manual review by the finance team. Please visit the{" "}
        <Link href={adminPayoutsUrl} style={{ color: COLORS.link, textDecoration: "underline" }}>
          admin payouts dashboard
        </Link>{" "}
        to investigate and resolve the issue.
      </TextBlock>
      <TextBlock>
        Common causes include:
        <br />• Stripe Connect payout account not fully verified
        <br />• Insufficient platform balance
        <br />• Invalid or closed bank account on the connected account
      </TextBlock>
      {sellerPayoutSetupUrl ? (
        <TextBlock>
          Ask the seller to finish payout setup in-app:{" "}
          <Link
            href={sellerPayoutSetupUrl}
            style={{ color: COLORS.link, textDecoration: "underline" }}
          >
            {sellerPayoutSetupUrl}
          </Link>
        </TextBlock>
      ) : null}
      <HelpBlock email={supportContactEmail} />
    </Layout>
  );
}
