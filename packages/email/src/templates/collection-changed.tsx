import { Button } from "../components/Button.js";
import { CollectionVisitFacts, PHOTO_ID_RULE } from "../components/CollectionVisitFacts.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["collection-changed"];

export const subject = ({ whenLabel }: Vars) => `Collection changed: now ${whenLabel}`;

export default function CollectionChangedEmail({
  userName,
  reference,
  whenLabel,
  previousWhenLabel,
  placeName,
  address,
  lots,
  collectorName,
  collectorIsOther,
  bookingUrl,
  changeUntilLabel,
}: Vars) {
  return (
    <Layout
      category="auction"
      eyebrow="Collection"
      preview={`Your collection has moved to ${whenLabel}.`}
      title="Your collection has moved"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        Your collection was {previousWhenLabel} and is now {whenLabel}. The calendar invite attached
        replaces the old entry.
      </TextBlock>
      <CollectionVisitFacts
        reference={reference}
        whenLabel={whenLabel}
        placeName={placeName}
        address={address}
        lots={lots}
        collectorName={collectorName}
      />
      <TextBlock>
        {collectorIsOther
          ? `${collectorName} will collect, and we've emailed them the new time. They need photo ID in their name.`
          : PHOTO_ID_RULE}
      </TextBlock>
      {changeUntilLabel ? (
        <TextBlock>Change or cancel online until {changeUntilLabel}.</TextBlock>
      ) : null}
      <Button href={bookingUrl}>View your collection</Button>
    </Layout>
  );
}
