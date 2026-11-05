import { COLORS } from "@auction/branding";
import { Link } from "@react-email/components";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["payment-unapplied-money-admin-notice"]) =>
  `Money received that could not be applied: ${vars.amount}`;

/**
 * Tells finance that money reached us but was not applied to an invoice: a payment on a closed
 * or already-paid invoice, a second payment, or a transfer left in a buyer's balance. Nothing is
 * refunded automatically.
 */
export default function PaymentUnappliedMoneyAdminNoticeEmail(
  vars: TemplateVarsByName["payment-unapplied-money-admin-notice"],
) {
  const { recipientFirstName, situation, amount, reference, lotTitle, reviewUrl } = vars;
  return (
    <Layout
      category="alert"
      eyebrow="Finance"
      preview={`${amount} received that could not be applied`}
      title="Money received that could not be applied"
    >
      <TextBlock>Hello {recipientFirstName ?? "team"},</TextBlock>
      <TextBlock>
        {situation} It has not been refunded. Decide whether to apply it or send it back.
      </TextBlock>
      <FactCard
        rows={[
          { label: "Amount", value: amount },
          ...(lotTitle ? [{ label: "Lot", value: lotTitle }] : []),
          { label: "Reference", value: reference, mono: true },
        ]}
      />
      <TextBlock>
        <Link href={reviewUrl} style={{ color: COLORS.link, textDecoration: "underline" }}>
          Open it in payments
        </Link>
      </TextBlock>
    </Layout>
  );
}
