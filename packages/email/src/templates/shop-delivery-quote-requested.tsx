import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "We have your delivery quote request";

export default function ShopDeliveryQuoteRequestedEmail({
  orderReference,
  countryName,
  holdUntilOn,
  itemsSummary,
}: TemplateVarsByName["shop-delivery-quote-requested"]) {
  return (
    <Layout
      category="auction"
      eyebrow="Delivery quote"
      preview={`We will quote delivery to ${countryName} within one working day.`}
      title="We have your delivery quote request"
    >
      <TextBlock>
        Thank you. We will quote delivery to {countryName} for order {orderReference} within one
        working day, and email you the price.
      </TextBlock>
      <TextBlock>{itemsSummary}</TextBlock>
      <TextBlock>
        Your print is held for you until {holdUntilOn}. You pay for the print and delivery together,
        from the link in our reply. Import duties and taxes in {countryName} are paid by you, and
        insurance is included in the quote.
      </TextBlock>
      <TextBlock>
        If you change your mind, reply to this email and we will release the print.
      </TextBlock>
    </Layout>
  );
}
