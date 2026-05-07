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
  } = vars;

  return (
    <Layout preview={`Payout transfer failed for ${entityName}`} title="Payout Transfer Failed">
      <TextBlock>Hi {recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        A payout transfer for <strong>{entityName}</strong> could not be completed.
      </TextBlock>
      <TextBlock>
        <strong>Payout Details:</strong>
        <br />• Amount: {payoutCurrency} {payoutAmount}
        <br />• Payout ID: {payoutId}
        <br />• Failure Reason: {failureReason}
      </TextBlock>
      <TextBlock>
        This payout requires manual review by the finance team. Please visit the{" "}
        <a href={adminPayoutsUrl}>admin payouts dashboard</a> to investigate and resolve the issue.
      </TextBlock>
      <TextBlock>
        Common causes include:
        <br />• Stripe Connect account not fully verified
        <br />• Insufficient platform balance
        <br />• Invalid or closed bank account on the connected account
      </TextBlock>
      <TextBlock>
        If you have questions, please contact{" "}
        <a href={`mailto:${supportContactEmail}`}>{supportContactEmail}</a>.
      </TextBlock>
    </Layout>
  );
}
