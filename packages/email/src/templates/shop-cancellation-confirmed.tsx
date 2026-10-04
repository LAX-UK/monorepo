import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "Your LAX Shop cancellation is confirmed";

export default function ShopCancellationConfirmedEmail({
  orderId,
  refundPeriodEndsAt,
}: TemplateVarsByName["shop-cancellation-confirmed"]) {
  return (
    <Layout
      category="finance"
      eyebrow="Cancellation"
      preview={`Cancellation confirmed for order ${orderId}`}
      title="Cancellation confirmed"
    >
      <TextBlock>Your cancellation for order {orderId} has been confirmed.</TextBlock>
      <TextBlock>
        The refund period ends on {refundPeriodEndsAt}. We will process any eligible refund after
        that date.
      </TextBlock>
    </Layout>
  );
}
