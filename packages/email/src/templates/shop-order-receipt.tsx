import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "Your LAX Shop order confirmation";

export default function ShopOrderReceiptEmail({
  orderReference,
  totalAmount,
  vatAmount,
  orderUrl,
  lineSummary,
}: TemplateVarsByName["shop-order-receipt"]) {
  return (
    <Layout
      category="finance"
      eyebrow="Order confirmed"
      preview={`Thank you for your order (${totalAmount}).`}
      title={orderReference ? `Order ${orderReference} is confirmed` : "Thank you for your order"}
    >
      <TextBlock>
        {vatAmount
          ? `We received your payment of ${totalAmount} (including ${vatAmount} VAT).`
          : `We received your payment of ${totalAmount}.`}
      </TextBlock>
      <TextBlock>{lineSummary}</TextBlock>
      <TextBlock>
        Your order page shows its progress and the invoice, and is where to report a problem.
      </TextBlock>
      <Button href={orderUrl}>View your order</Button>
    </Layout>
  );
}
