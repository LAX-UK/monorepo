import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

function formatPence(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

export const subject = "Your LAX Shop cancellation is confirmed";

export default function ShopCancellationConfirmedEmail({
  orderId,
  orderReference,
  artworkTitle,
  amountPence,
}: TemplateVarsByName["shop-cancellation-confirmed"]) {
  const order = orderReference ?? orderId;
  return (
    <Layout
      category="finance"
      eyebrow="Cancellation"
      preview={`${artworkTitle} is cancelled and ${formatPence(amountPence)} is being refunded`}
      title="Your cancellation is confirmed"
    >
      <TextBlock>
        We have cancelled {artworkTitle} from your order {order} and are refunding{" "}
        {formatPence(amountPence)} to your original payment method.
      </TextBlock>
      <TextBlock>
        We will email you again when the refund has been issued. It may then take a few days to
        appear on your statement, depending on your bank.
      </TextBlock>
    </Layout>
  );
}
