import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "Your LAX Shop order confirmation";

export default function ShopOrderReceiptEmail({
  totalAmount,
  orderUrl,
  lineSummary,
}: TemplateVarsByName["shop-order-receipt"]) {
  return (
    <Layout
      category="finance"
      eyebrow="Order confirmed"
      preview={`Thank you for your order (${totalAmount}).`}
      title="Thank you for your order"
    >
      <TextBlock>We received your payment of {totalAmount}.</TextBlock>
      <TextBlock>{lineSummary}</TextBlock>
      <Button href={orderUrl}>View your order</Button>
    </Layout>
  );
}
