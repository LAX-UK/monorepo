import { Button } from "../components/Button.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["bid-invoice-issued"];

export const subject = (vars: Vars) => `Your invoice ${vars.invoiceNumber} from LAX Bid`;

/** "Paid on Thu 12 Nov, 14:05 GMT." or "Due by Thu 26 Nov, 23:59 GMT." */
export function settlementLine(settlement: Vars["settlement"]): string {
  return settlement.kind === "paid" ? `Paid on ${settlement.on}.` : `Due by ${settlement.by}.`;
}

/** The one sentence the email is: what is attached, the total and whether it is paid. */
export function invoiceSentence(vars: Pick<Vars, "lotTitle" | "total" | "settlement">): string {
  return `Your invoice for ${vars.lotTitle} is attached. Total ${vars.total}. ${settlementLine(vars.settlement)}`;
}

/**
 * The invoice Books issued for a Bid purchase, sent once, with LAX's stored copy of its PDF
 * attached. The figures are the invoice's frozen lines, formatted by the sender.
 */
export default function BidInvoiceIssuedEmail(vars: Vars) {
  return (
    <Layout
      category="finance"
      eyebrow="Invoice"
      preview={invoiceSentence(vars)}
      title={`Invoice ${vars.invoiceNumber}`}
    >
      <TextBlock>Hi {vars.userName || "there"},</TextBlock>
      <TextBlock>{invoiceSentence(vars)}</TextBlock>
      <Button href={vars.purchaseUrl}>View your purchase</Button>
    </Layout>
  );
}
