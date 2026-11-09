import { FactCard } from "./FactCard.js";

type Props = {
  reference: string;
  whenLabel: string;
  placeName: string;
  address: string;
  lots: readonly string[];
  /** Who is coming, when the email is for the buyer. */
  collectorName?: string | undefined;
};

/** The visit as a card: when, where, what and who. The same in every collection email. */
export function CollectionVisitFacts({
  reference,
  whenLabel,
  placeName,
  address,
  lots,
  collectorName,
}: Props) {
  return (
    <FactCard
      rows={[
        { label: "When", value: whenLabel },
        { label: "Where", value: `${placeName}, ${address}` },
        { label: lots.length === 1 ? "Lot" : "Lots", value: lots.join("; ") },
        { label: "Who collects", value: collectorName },
        { label: "Reference", value: reference, mono: true },
      ]}
    />
  );
}

/** What the gallery asks of whoever collects. */
export const PHOTO_ID_RULE =
  "Bring photo ID in the name of whoever is collecting: a passport, driving licence or national identity card.";
