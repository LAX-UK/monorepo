import { CollectionVisitFacts, PHOTO_ID_RULE } from "../components/CollectionVisitFacts.js";
import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["collection-collector-notice"];

export const subject = ({ lots, dayLabel, onBehalfOf }: Vars) =>
  lots.length === 1
    ? `You're collecting for ${onBehalfOf}`
    : `You're collecting ${lots.length} lots on ${dayLabel}`;

/**
 * To someone named to collect on a buyer's behalf. It carries the time, the place and the ID
 * rule, and nothing about money: no price, no payment and no link into the buyer's account.
 */
export default function CollectionCollectorNoticeEmail({
  collectorName,
  onBehalfOf,
  bookedBy,
  reference,
  whenLabel,
  placeName,
  address,
  lots,
}: Vars) {
  const what = lots.length === 1 ? "a lot" : `${lots.length} lots`;
  return (
    <Layout
      category="auction"
      eyebrow="Collection"
      preview={`${onBehalfOf} has asked you to collect ${what}.`}
      title={`You're collecting for ${onBehalfOf}`}
    >
      <TextBlock>Hi {collectorName},</TextBlock>
      <TextBlock>
        {onBehalfOf} has asked you to collect {what} on their behalf. A calendar invite is attached.
      </TextBlock>
      <TextBlock>
        {bookedBy
          ? `Authorised by ${onBehalfOf}, booked by ${bookedBy}.`
          : `Authorised by ${onBehalfOf}.`}
      </TextBlock>
      <CollectionVisitFacts
        reference={reference}
        whenLabel={whenLabel}
        placeName={placeName}
        address={address}
        lots={lots}
      />
      <TextBlock>{PHOTO_ID_RULE}</TextBlock>
      <TextBlock>
        If this isn't right, or the time no longer works, please contact {bookedBy ?? onBehalfOf}:
        they can change the booking.
      </TextBlock>
    </Layout>
  );
}
