import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "Your link to your LAX Shop order";

export default function ShopGuestOrderLinkEmail({
  orderReference,
  orderUrl,
  expiresOn,
}: TemplateVarsByName["shop-guest-order-link"]) {
  return (
    <Layout
      category="finance"
      eyebrow="Your order"
      preview={`A new link to order ${orderReference}.`}
      title={`Your link to order ${orderReference}`}
    >
      <TextBlock>
        You asked for a new link to your order. It opens the order page without an account until{" "}
        {expiresOn}.
      </TextBlock>
      <Button href={orderUrl}>View your order</Button>
      <TextBlock>
        If you did not ask for this, you can ignore this email. The link only shows this order.
      </TextBlock>
    </Layout>
  );
}
