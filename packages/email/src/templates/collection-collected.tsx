import { Button } from "../components/Button.js";
import { FactCard } from "../components/FactCard.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["collection-collected"];

/** "A", "A and B", "A, B and C". */
const named = (titles: readonly string[]) =>
  titles.length <= 1
    ? (titles[0] ?? "")
    : `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`;

export const subject = ({ collectedLots }: Vars) => `Collected: ${named(collectedLots)}`;

export default function CollectionCollectedEmail({
  userName,
  reference,
  dayLabel,
  collectorName,
  collectedLots,
  leftLots,
  bookUrl,
}: Vars) {
  return (
    <Layout
      category="auction"
      eyebrow="Collection"
      preview={`${named(collectedLots)} collected on ${dayLabel}.`}
      title="Thank you for collecting"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        {collectorName} collected {named(collectedLots)} on {dayLabel}.
      </TextBlock>
      {leftLots.length > 0 ? (
        <TextBlock>
          {named(leftLots)} stayed with us, paid and safe, until you book another time.
        </TextBlock>
      ) : null}
      <FactCard
        rows={[
          { label: "Day", value: dayLabel },
          { label: "Collected", value: collectedLots.join("; ") },
          { label: "Collected by", value: collectorName },
          { label: "Reference", value: reference, mono: true },
        ]}
      />
      {leftLots.length > 0 ? <Button href={bookUrl}>Book a collection time</Button> : null}
    </Layout>
  );
}
