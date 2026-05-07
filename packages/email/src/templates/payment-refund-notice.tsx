import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["payment-refund-notice"]) =>
  vars.eventKind === "dispute_lost"
    ? `Chargeback upheld for ${vars.lotTitle}`
    : `Refund processed for ${vars.lotTitle}`;

export default function PaymentRefundNoticeEmail(
  vars: TemplateVarsByName["payment-refund-notice"],
) {
  const {
    recipientFirstName,
    entityName,
    lotTitle,
    lotReference,
    refundAmount,
    refundCurrency,
    eventKind,
    reason,
    supportContactEmail,
  } = vars;

  const isDisputeLost = eventKind === "dispute_lost";
  const headline = isDisputeLost
    ? "A chargeback has been upheld"
    : "A refund has been processed";

  const explanation = isDisputeLost
    ? "The buyer's bank ruled in their favour and the disputed amount has been deducted from your account."
    : "A refund has been issued to the buyer for this transaction.";

  return (
    <Layout preview={`${headline} for ${lotTitle}`} title={headline}>
      <TextBlock>Hi {recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        {headline} for a sale by <strong>{entityName}</strong>.
      </TextBlock>
      <TextBlock>
        <strong>Transaction Details:</strong>
        <br />
        • Lot: {lotTitle}
        {lotReference && (
          <>
            <br />• Reference: {lotReference}
          </>
        )}
        <br />
        • Amount: {refundCurrency} {refundAmount}
        {reason && (
          <>
            <br />• Reason: {reason}
          </>
        )}
      </TextBlock>
      <TextBlock>{explanation}</TextBlock>
      <TextBlock>
        <strong>Impact on your next payout:</strong> A negative adjustment line
        will appear on your next payout statement to offset this{" "}
        {isDisputeLost ? "chargeback" : "refund"}.
      </TextBlock>
      <TextBlock>
        If you have questions or believe this was processed in error, please
        contact{" "}
        <a href={`mailto:${supportContactEmail}`}>{supportContactEmail}</a>.
      </TextBlock>
    </Layout>
  );
}
