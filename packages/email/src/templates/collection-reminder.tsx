import { Button } from "../components/Button.js";
import { CollectionVisitFacts, PHOTO_ID_RULE } from "../components/CollectionVisitFacts.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["collection-reminder"];

export const subject = ({ timeLabel }: Vars) => `Tomorrow: your collection at ${timeLabel}`;

export default function CollectionReminderEmail({
  userName,
  reference,
  whenLabel,
  timeLabel,
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
      preview={`Your collection is tomorrow at ${timeLabel}.`}
      title={`See you tomorrow at ${timeLabel.split(" ")[0]}`}
    >
      <TextBlock>Hi {userName || "there"},</TextBlock>
      <TextBlock>A reminder that your collection is tomorrow.</TextBlock>
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
          ? `${collectorName} is collecting and needs photo ID in their name.`
          : PHOTO_ID_RULE}
      </TextBlock>
      {changeUntilLabel ? (
        <TextBlock>Change or cancel online until {changeUntilLabel}.</TextBlock>
      ) : null}
      <Button href={bookingUrl}>View your collection</Button>
    </Layout>
  );
}
