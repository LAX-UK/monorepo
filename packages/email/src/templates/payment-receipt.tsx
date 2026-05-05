import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "Payment receipt";

export default function PaymentReceiptEmail({
  userName,
  lotTitle,
  amount,
  receiptUrl,
}: TemplateVarsByName["payment-receipt"]) {
  return (
    <Layout preview={`Payment received for ${lotTitle}.`} title="Payment received">
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        We received your payment of {amount} for {lotTitle}.
      </TextBlock>
      {receiptUrl ? <Button href={receiptUrl}>View receipt</Button> : null}
    </Layout>
  );
}
