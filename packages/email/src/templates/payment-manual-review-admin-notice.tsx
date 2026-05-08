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
      preview={`Manual payment review required for ${lotTitle}`}
      title="Manual Payment Review"
    >
      <TextBlock>
        A winning payment requires manual review because the seller entity is archived.
      </TextBlock>
      <TextBlock>
        <strong>Review Details:</strong>
        <br />• Lot: {lotLabel}
        <br />• Seller entity: {sellerEntityName}
        <br />• Amount: {currency} {amount}
        <br />• Payment ID: {paymentId}
      </TextBlock>
      <TextBlock>
        Open the <a href={adminReviewUrl}>manual payment review queue</a> to capture and process or
        refund the buyer.
      </TextBlock>
    </Layout>
  );
}
