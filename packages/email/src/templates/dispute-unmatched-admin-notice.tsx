import { COLORS } from "@auction/branding";
import { Link } from "@react-email/components";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["dispute-unmatched-admin-notice"]) =>
  `Unmatched Stripe dispute ${vars.disputeId} needs a response`;

export default function DisputeUnmatchedAdminNoticeEmail(
  vars: TemplateVarsByName["dispute-unmatched-admin-notice"],
) {
  const {
    disputeId,
    chargeId,
    amount,
    currency,
    reason,
    status,
    respondBy,
    stripeEventType,
    stripeDashboardUrl,
  } = vars;

  return (
    <Layout
      category="alert"
      eyebrow="Admin · dispute"
      preview={`Stripe dispute ${disputeId} matches no payment`}
      title="Unmatched payment dispute"
    >
      <TextBlock>
        Stripe sent a dispute for a charge that matches no payment on the platform, so no seller
        adjustment was made. Review it in Stripe and respond before the deadline.
      </TextBlock>
      <FactCard
        rows={[
          { label: "Dispute", value: disputeId, mono: true },
          { label: "Charge", value: chargeId, mono: true },
          { label: "Amount", value: `${currency} ${amount}` },
          { label: "Reason", value: reason || "Not provided" },
          { label: "Respond by", value: respondBy || "Not provided" },
          { label: "Status", value: status },
          { label: "Stripe event", value: stripeEventType, mono: true },
        ]}
      />
      <TextBlock>
        Open the{" "}
        <Link href={stripeDashboardUrl} style={{ color: COLORS.link, textDecoration: "underline" }}>
          dispute in the Stripe dashboard
        </Link>
        .
      </TextBlock>
    </Layout>
  );
}
