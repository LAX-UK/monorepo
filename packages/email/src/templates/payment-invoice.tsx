import { COLORS } from "@auction/branding";
import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "Payment invoice";

export default function PaymentInvoiceEmail({
  userName,
  invoiceNumber,
  amount,
  invoiceUrl,
  billTo,
  dueDate,
}: TemplateVarsByName["payment-invoice"]) {
  const billToValue =
    billTo.addressLines.length === 0 ? (
      <span style={{ color: COLORS.textMuted }}>No billing address on file (ops notified).</span>
    ) : (
      <>
        {billTo.billToName}
        <br />
        {billTo.addressLines.map((line, i) => (
          <span key={`${i}-${line.slice(0, 24)}`}>
            {line}
            <br />
          </span>
        ))}
        {billTo.vatLine ? (
          <>
            <br />
            {billTo.vatLine}
          </>
        ) : null}
      </>
    );

  return (
    <Layout
      category="finance"
      eyebrow="Invoice"
      preview={`Invoice ${invoiceNumber} — bill-to`}
      title="Payment invoice"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        Invoice {invoiceNumber} for {amount} is ready.
      </TextBlock>
      <FactCard
        rows={[
          { label: "Bill to", value: billToValue },
          { label: "Invoice", value: invoiceNumber, mono: true },
          { label: "Amount", value: amount },
          ...(dueDate ? [{ label: "Due by", value: dueDate }] : []),
        ]}
      />
      <Button href={invoiceUrl}>View invoice</Button>
    </Layout>
  );
}
