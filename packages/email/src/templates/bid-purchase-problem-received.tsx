import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["bid-purchase-problem-received"];

export const subject = ({ reference }: Vars) => `We have your report (${reference})`;

/**
 * The buyer's copy of a purchase problem they reported: the reference, the lot and the kind of
 * problem. Email is not a confidential channel, so what the buyer wrote stays out of it.
 */
export default function BidPurchaseProblemReceivedEmail(vars: Vars) {
  const { reference, lotTitle, categoryLabel, purchaseUrl, contactEmail } = vars;
  return (
    <Layout
      category="account"
      eyebrow="Your purchase"
      preview={`We have your report. Your reference is ${reference}.`}
      title="We have your report"
    >
      <TextBlock>Hi {vars.userName || "there"},</TextBlock>
      <TextBlock>
        Thank you for telling us about a problem with {lotTitle}. Our team will look into it and
        write to you.
      </TextBlock>
      <FactCard
        rows={[
          { label: "Reference", value: reference, mono: true },
          { label: "Lot", value: lotTitle },
          { label: "Problem", value: categoryLabel },
        ]}
      />
      <Button href={purchaseUrl}>View your purchase</Button>
      <TextBlock>
        If you need to add anything, write to {contactEmail} and quote the reference.
      </TextBlock>
    </Layout>
  );
}
