import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["collection-missed"];

export const subject = (_vars: Vars) => "We missed you today";

export default function CollectionMissedEmail({
  userName,
  reference,
  whenLabel,
  placeName,
  lots,
  bookUrl,
}: Vars) {
  return (
    <Layout
      category="auction"
      eyebrow="Collection"
      preview={`We missed you at ${placeName}.`}
      title="Book another time to collect"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        We expected you at {placeName} for your collection, and no one came. Your lots stay with us,
        paid and safe, until you book another time.
      </TextBlock>
      <FactCard
        rows={[
          { label: "Booked for", value: whenLabel },
          { label: lots.length === 1 ? "Lot" : "Lots", value: lots.join("; ") },
          { label: "Reference", value: reference, mono: true },
        ]}
      />
      <Button href={bookUrl}>Book another time</Button>
    </Layout>
  );
}
