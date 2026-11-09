import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["collection-collect-by"];

export const subject = ({ when, collectByLabel }: Vars) =>
  when === "day" ? "Please collect today" : `Please collect by ${collectByLabel}`;

export default function CollectionCollectByEmail({
  userName,
  when,
  collectByLabel,
  placeName,
  address,
  lots,
  bookUrl,
}: Vars) {
  const plural = lots.length === 1 ? "lot is" : "lots are";
  return (
    <Layout
      category="auction"
      eyebrow="Collection"
      preview={
        when === "day" ? "Today is the day to collect." : `Please collect by ${collectByLabel}.`
      }
      title={when === "day" ? "Today is the day to collect" : "Please collect within a week"}
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        Your {plural} ready at {placeName}. Please collect by {collectByLabel}. After that, storage
        charges may apply under our storage policy.
      </TextBlock>
      <FactCard
        rows={[
          { label: "Please collect by", value: collectByLabel },
          { label: "Where", value: `${placeName}, ${address}` },
          { label: lots.length === 1 ? "Lot" : "Lots", value: lots.join("; ") },
        ]}
      />
      <TextBlock>Book a time to come in, or ask us for a courier quote.</TextBlock>
      <Button href={bookUrl}>Book a collection time</Button>
    </Layout>
  );
}
