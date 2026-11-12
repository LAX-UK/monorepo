import { paymentReminderCopy } from "../buyer-default-copy.js";
import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { HelpBlock } from "../components/HelpBlock.js";
import { Layout } from "../components/Layout.js";
import { MomentValue } from "../components/MomentValue.js";
import { TextBlock } from "../components/TextBlock.js";
import { ZoneNoteLine } from "../components/ZoneNoteLine.js";
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
          { label: vars.itemLabel ?? "Lot", value: vars.lotTitle },
          { label: "Amount", value: vars.amount },
          { label: "Due", value: vars.due ? <MomentValue moment={vars.due} /> : vars.dueDate },
        ]}
      />
      <ZoneNoteLine note={vars.zoneNote} />
      {vars.held === "identity_verification_required" && vars.actionUrl ? (
        <Button href={vars.actionUrl}>Verify your identity</Button>
      ) : vars.held ? null : (
        <Button href={vars.payUrl}>Pay now</Button>
      )}
      <HelpBlock email={vars.supportContactEmail} />
    </Layout>
  );
}
