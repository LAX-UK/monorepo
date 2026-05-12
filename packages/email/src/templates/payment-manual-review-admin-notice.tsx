import { COLORS } from "@auction/branding";
import { Link } from "@react-email/components";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["payment-manual-review-admin-notice"]) =>
  `Manual payment review required for ${vars.lotTitle}`;

export default function PaymentManualReviewAdminNoticeEmail(
  vars: TemplateVarsByName["payment-manual-review-admin-notice"],
) {
  const { paymentId, lotTitle, lotReference, sellerEntityName, amount, currency, adminReviewUrl } =
    vars;
  const lotLabel = lotReference ? `${lotTitle} (lot ${lotReference})` : lotTitle;

  return (
    <Layout
      category="alert"
      eyebrow="Admin · manual review"
      preview={`Manual payment review required for ${lotTitle}`}
      title="Manual payment review"
    >
      <TextBlock>
        A winning payment requires manual review because the seller entity is archived.
      </TextBlock>
      <FactCard
        rows={[
          { label: "Lot", value: lotLabel },
          { label: "Seller entity", value: sellerEntityName },
          { label: "Amount", value: `${currency} ${amount}` },
          { label: "Payment ID", value: paymentId, mono: true },
        ]}
      />
      <TextBlock>
        Open the{" "}
        <Link href={adminReviewUrl} style={{ color: COLORS.link, textDecoration: "underline" }}>
          manual payment review queue
        </Link>{" "}
        to capture and process or refund the buyer.
      </TextBlock>
    </Layout>
  );
}
