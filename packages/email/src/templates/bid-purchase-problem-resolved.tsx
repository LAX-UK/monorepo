import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["bid-purchase-problem-resolved"];

export const subject = ({ reference }: Vars) => `Your report is resolved (${reference})`;

/** Tells the buyer their report is closed. Staff notes are internal and never in it. */
export default function BidPurchaseProblemResolvedEmail(vars: Vars) {
  const { reference, lotTitle, purchaseUrl, contactEmail } = vars;
  return (
    <Layout
      category="account"
      eyebrow="Your purchase"
      preview={`Your report ${reference} is resolved.`}
      title="Your report is resolved"
    >
      <TextBlock>Hi {vars.userName || "there"},</TextBlock>
      <TextBlock>We have marked your report about {lotTitle} as resolved.</TextBlock>
      <FactCard
        rows={[
          { label: "Reference", value: reference, mono: true },
          { label: "Lot", value: lotTitle },
        ]}
      />
      <Button href={purchaseUrl}>View your purchase</Button>
      <TextBlock>
        If the problem is not put right, write to {contactEmail} and quote the reference.
      </TextBlock>
    </Layout>
  );
}
