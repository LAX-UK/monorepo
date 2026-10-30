import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "Payment receipt";

type Vars = TemplateVarsByName["payment-receipt"];

/** One payment that settled several invoices: each invoice, the total and how it was paid. */
function SeveralInvoicesReceipt({
  lines,
  amount,
  paymentMethod,
}: {
  lines: NonNullable<Vars["lines"]>;
  amount: string | null | undefined;
  paymentMethod: string | null | undefined;
}) {
  return (
    <>
      <TextBlock>
        {amount
          ? `We received your payment of ${amount} for ${lines.length} invoices.`
          : `We received your payment for ${lines.length} invoices.`}
      </TextBlock>
      <FactCard
        rows={[
          ...lines.map((line) => ({ label: line.title, value: line.amount })),
          { label: "Total", value: amount ?? null },
          { label: "Paid by", value: paymentMethod ?? null },
        ]}
      />
    </>
  );
}

export default function PaymentReceiptEmail({
  userName,
  lotTitle,
  amount,
  receiptUrl,
  lines,
  paymentMethod,
}: Vars) {
  const several = lines && lines.length > 1 ? lines : null;
  return (
    <Layout
      category="finance"
      eyebrow="Payment received"
      preview={
        several
          ? `Payment received for ${several.length} invoices.`
          : `Payment received for ${lotTitle}.`
      }
      title="Payment received"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      {several ? (
        <SeveralInvoicesReceipt lines={several} amount={amount} paymentMethod={paymentMethod} />
      ) : (
        <TextBlock>
          {amount
            ? `We received your payment of ${amount} for ${lotTitle}.`
            : `We received your payment for ${lotTitle}.`}
        </TextBlock>
      )}
      {receiptUrl ? (
        <Button href={receiptUrl}>{several ? "View your purchases" : "View your purchase"}</Button>
      ) : null}
    </Layout>
  );
}
