import { paymentReminderCopy } from "../buyer-default-copy.js";
import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

export const subject = (vars: TemplateVarsByName["payment-reminder"]) =>
  paymentReminderCopy(vars.step, vars).title;

export default function PaymentReminderEmail(vars: TemplateVarsByName["payment-reminder"]) {
  const copy = paymentReminderCopy(vars.step, vars);
  return (
    <Layout
      category="finance"
      eyebrow="Payment reminder"
      preview={copy.paragraphs[0] ?? copy.heading}
      title={copy.heading}
    >
      <TextBlock>Hi {vars.userName || "there"},</TextBlock>
      {copy.paragraphs.map((paragraph) => (
        <TextBlock key={paragraph}>{paragraph}</TextBlock>
      ))}
      <FactCard
        rows={[
          { label: "Lot", value: vars.lotTitle },
          { label: "Amount", value: vars.amount },
          { label: "Due", value: vars.dueDate },
        ]}
      />
      <Button href={vars.payUrl}>Pay now</Button>
      <HelpBlock email={vars.supportContactEmail} />
    </Layout>
  );
}
