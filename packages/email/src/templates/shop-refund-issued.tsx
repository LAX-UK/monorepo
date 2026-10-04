import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

export const subject = "Your LAX Shop refund";

export default function ShopRefundIssuedEmail({
  orderId,
  amountPence,
}: TemplateVarsByName["shop-refund-issued"]) {
  return (
    <Layout
      category="finance"
      eyebrow="Refund"
      preview={`Refund of ${formatPence(amountPence)} for order ${orderId}`}
      title="Your refund is on its way"
    >
      <TextBlock>
        We have issued a refund of {formatPence(amountPence)} for your order ({orderId}).
      </TextBlock>
      <TextBlock>
        It may take a few days to appear on your statement, depending on your bank.
      </TextBlock>
    </Layout>
  );
}
