import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "Your delivery quote is ready";

export default function ShopDeliveryQuoteReadyEmail({
  orderReference,
  countryName,
  carrier,
  service,
  leadTimeNote,
  deliveryPrice,
  totalPrice,
  validUntilOn,
  orderUrl,
}: TemplateVarsByName["shop-delivery-quote-ready"]) {
  return (
    <Layout
      category="auction"
      eyebrow="Delivery quote"
      preview={`Delivery to ${countryName} is ${deliveryPrice}.`}
      title="Your delivery quote is ready"
    >
      <TextBlock>
        Delivery to {countryName} for order {orderReference} is {deliveryPrice}, with {carrier}
        {service ? ` (${service})` : ""}. Insurance is included in that price. With your print the
        total is {totalPrice}.
      </TextBlock>
      {leadTimeNote ? <TextBlock>{leadTimeNote}</TextBlock> : null}
      <TextBlock>
        You pay any import duties and taxes charged in {countryName}. We do not collect them, and
        they are not in this price.
      </TextBlock>
      <TextBlock>
        Your print is held for you until {validUntilOn}. To accept the quote and pay for the print
        and delivery together, open your order: {orderUrl}
      </TextBlock>
    </Layout>
  );
}
