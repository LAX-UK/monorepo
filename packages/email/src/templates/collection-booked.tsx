import { Button } from "../components/Button.js";
import { CollectionVisitFacts, PHOTO_ID_RULE } from "../components/CollectionVisitFacts.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["collection-booked"];

export const subject = ({ whenLabel }: Vars) => `Collection booked: ${whenLabel}`;

export default function CollectionBookedEmail({
  userName,
  reference,
  whenLabel,
  placeName,
  address,
  lots,
  collectorName,
  collectorIsOther,
  bookingUrl,
  changeUntilLabel,
  collectByLabel,
}: Vars) {
  return (
    <Layout
      category="auction"
      eyebrow="Collection"
      preview={`Collection booked for ${whenLabel}.`}
      title="Your collection is booked"
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>
        We've booked your collection. A calendar invite is attached, and it updates if the time
        changes.
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
          ? `${collectorName} will collect, and we've emailed them the details. They need photo ID in their name: a passport, driving licence or national identity card.`
          : PHOTO_ID_RULE}
      </TextBlock>
      {changeUntilLabel ? (
        <TextBlock>Change or cancel online until {changeUntilLabel}.</TextBlock>
      ) : null}
      {collectByLabel ? <TextBlock>Please collect by {collectByLabel}.</TextBlock> : null}
      <Button href={bookingUrl}>View your collection</Button>
    </Layout>
  );
}
