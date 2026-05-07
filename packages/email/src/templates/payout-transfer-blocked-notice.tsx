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
    <Layout preview={`Payout blocked for ${entityName}`} title="Payout Blocked">
      <TextBlock>Hi {recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        A payout for <strong>{entityName}</strong> is ready, but Stripe Connect is not currently
        payout-ready for this organisation.
      </TextBlock>
      <TextBlock>
        <strong>Payout Details:</strong>
        <br />
        • Amount: {payoutCurrency} {payoutAmount}
        <br />
        • Payout ID: {payoutId}
        <br />• Reason: {blockReason}
      </TextBlock>
      <TextBlock>
        The payout will stay scheduled until the Connect account can receive payouts. Please review
        the <a href={adminPayoutsUrl}>admin payouts dashboard</a> and complete any outstanding
        Stripe Connect requirements.
      </TextBlock>
      <TextBlock>
        If you have questions, please contact{" "}
        <a href={`mailto:${supportContactEmail}`}>{supportContactEmail}</a>.
      </TextBlock>
    </Layout>
  );
}
