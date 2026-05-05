import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = "Invoice issued";

export default function InvoiceIssuedEmail({
  userName,
  invoiceNumber,
  amount,
  invoiceUrl,
}: TemplateVarsByName["invoice-issued"]) {
  return (
    <Layout preview={`Invoice ${invoiceNumber} is ready.`} title="Invoice issued">
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        Invoice {invoiceNumber} for {amount} is now available in your account.
      </TextBlock>
      <Button href={invoiceUrl}>View invoice</Button>
    </Layout>
  );
}
