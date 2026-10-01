import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "Shop checkout requires manual review";

export default function ShopCheckoutOpsAlertEmail({
  alertKind,
  orderId,
  detail,
}: TemplateVarsByName["shop-checkout-ops-alert"]) {
  return (
    <Layout
      category="alert"
      eyebrow="Shop checkout"
      preview={`${alertKind} for order ${orderId}`}
      title="Checkout anomaly"
    >
      <TextBlock>Alert: {alertKind}</TextBlock>
      <TextBlock>Order ID: {orderId}</TextBlock>
      <TextBlock>{detail}</TextBlock>
    </Layout>
  );
}
