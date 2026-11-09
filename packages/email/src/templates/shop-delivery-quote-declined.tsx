import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "We cannot deliver your order there";

export default function ShopDeliveryQuoteDeclinedEmail({
  orderReference,
  countryName,
  note,
  collectionUrl,
}: TemplateVarsByName["shop-delivery-quote-declined"]) {
  return (
    <Layout
      category="auction"
      eyebrow="Delivery quote"
      preview={`We cannot deliver order ${orderReference} to ${countryName}.`}
      title="We cannot deliver your order there"
    >
      <TextBlock>
        We are sorry: we cannot deliver order {orderReference} to {countryName}. {note}
      </TextBlock>
      <TextBlock>
        Nothing has been charged, and your print has been released. Your basket is back as it was,
        and you can collect from our London gallery instead.
      </TextBlock>
      <Button href={collectionUrl}>See collection</Button>
    </Layout>
  );
}
