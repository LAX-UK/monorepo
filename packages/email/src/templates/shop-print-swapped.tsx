import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "Your LAX Shop print is a different number";

export default function ShopPrintSwappedEmail({
  orderReference,
  artworkTitle,
  previousLabel,
  newLabel,
}: TemplateVarsByName["shop-print-swapped"]) {
  return (
    <Layout
      category="auction"
      eyebrow="Your order"
      preview={`${artworkTitle} will be sent as ${newLabel}.`}
      title={`Your print is ${newLabel}`}
    >
      <TextBlock>
        We are sending you {artworkTitle} as {newLabel} instead of {previousLabel}
        {orderReference ? ` for your order ${orderReference}` : ""}. The print you first expected
        could not be sent, and this one is from the same edition.
      </TextBlock>
      <TextBlock>If you have any questions about the change, reply to this email.</TextBlock>
    </Layout>
  );
}
