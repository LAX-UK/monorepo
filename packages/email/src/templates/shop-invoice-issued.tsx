import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["shop-invoice-issued"];

export const subject = (vars: Vars) => `Your invoice ${vars.invoiceNumber} from LAX Shop`;

/** The one sentence the email is: what is attached, the total and when it was paid. */
export function shopInvoiceSentence(
  vars: Pick<Vars, "orderReference" | "total" | "paidOn">,
): string {
  return `Your invoice for order ${vars.orderReference} is attached. Total ${vars.total}. Paid on ${vars.paidOn}.`;
}

/**
 * The invoice Books issued for a paid Shop order, sent once, with LAX's stored copy of its PDF
 * attached. Every figure is the order's own, formatted by the sender.
 */
export default function ShopInvoiceIssuedEmail(vars: Vars) {
  return (
    <Layout
      category="finance"
      eyebrow="Invoice"
      preview={shopInvoiceSentence(vars)}
      title={`Invoice ${vars.invoiceNumber}`}
    >
      <TextBlock>Hi {vars.userName || "there"},</TextBlock>
      <TextBlock>{shopInvoiceSentence(vars)}</TextBlock>
      <Button href={vars.orderUrl}>View your order</Button>
    </Layout>
  );
}
