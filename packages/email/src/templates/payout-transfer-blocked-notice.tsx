import { COLORS } from "@auction/branding";
import { Link } from "@react-email/components";
import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["payout-transfer-blocked-notice"]) =>
  vars.audience === "staff"
    ? `Payout blocked for ${vars.entityName}`
    : `Your payout for ${vars.entityName} is waiting on your payout account`;

export default function PayoutTransferBlockedNoticeEmail(
  vars: TemplateVarsByName["payout-transfer-blocked-notice"],
) {
  const {
    audience,
    recipientFirstName,
    entityName,
    payoutId,
    payoutAmount,
    payoutCurrency,
    blockReason,
    supportContactEmail,
    payoutsUrl,
    sellerPayoutSetupUrl,
  } = vars;

  if (audience === "staff") {
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
          The payout will stay scheduled until the Connect account can receive payouts. Please
          review the{" "}
          <Link href={payoutsUrl} style={{ color: COLORS.link, textDecoration: "underline" }}>
            admin payouts dashboard
          </Link>{" "}
          and complete any outstanding Stripe Connect requirements.
        </TextBlock>
        <HelpBlock email={supportContactEmail} />
      </Layout>
    );
  }

  return (
    <Layout
      category="alert"
      eyebrow="Payout"
      preview={`Your payout for ${entityName} is waiting on your payout account`}
      title="Your payout is waiting on your payout account"
    >
      <TextBlock>Hi {recipientFirstName || "there"},</TextBlock>
      <TextBlock>
        A payout for <strong>{entityName}</strong> is ready, but we cannot send it until your payout
        account can receive money.
      </TextBlock>
      <FactCard
        rows={[
          { label: "Amount", value: `${payoutCurrency} ${payoutAmount}` },
          { label: "Payout ID", value: payoutId, mono: true },
          { label: "Reason", value: blockReason },
        ]}
      />
      <TextBlock>
        The payout stays scheduled and will be sent as soon as your payout account is ready. Finish
        any outstanding steps to release it.
      </TextBlock>
      <Button href={sellerPayoutSetupUrl || payoutsUrl}>Set up your payout account</Button>
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
