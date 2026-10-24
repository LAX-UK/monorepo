import { COLORS } from "@auction/branding";
import { Link } from "@react-email/components";
import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["payout-transfer-failed-notice"]) =>
  vars.audience === "staff"
    ? `Payout transfer failed for ${vars.entityName}`
    : `We could not send your payout for ${vars.entityName}`;

export default function PayoutTransferFailedNoticeEmail(
  vars: TemplateVarsByName["payout-transfer-failed-notice"],
) {
  const {
    audience,
    recipientFirstName,
    entityName,
    payoutId,
    payoutAmount,
    payoutCurrency,
    failureReason,
    supportContactEmail,
    payoutsUrl,
    sellerPayoutSetupUrl,
  } = vars;

  if (audience === "staff") {
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
          <Link href={payoutsUrl} style={{ color: COLORS.link, textDecoration: "underline" }}>
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

  return (
    <Layout
      category="alert"
      eyebrow="Payout"
      preview={`We could not send your payout for ${entityName}`}
      title="We could not send your payout"
    >
      <TextBlock>Hi {recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        We tried to pay out your sales for <strong>{entityName}</strong>, but the transfer did not
        go through. Your money is safe and the payout has not been lost.
      </TextBlock>
      <FactCard
        rows={[
          { label: "Amount", value: `${payoutCurrency} ${payoutAmount}` },
          { label: "Payout ID", value: payoutId, mono: true },
        ]}
      />
      <TextBlock>
        The most common cause is a payout account that is not fully set up or has changed. Please
        check your payout details; our team is also looking into it and will be in touch if we need
        anything else.
      </TextBlock>
      <Button href={sellerPayoutSetupUrl || payoutsUrl}>Check your payout account</Button>
      <TextBlock>
        You can follow the payout in{" "}
        <Link href={payoutsUrl} style={{ color: COLORS.link, textDecoration: "underline" }}>
          Sold &amp; payouts
        </Link>
        .
      </TextBlock>
      <HelpBlock email={supportContactEmail} />
    </Layout>
  );
}
