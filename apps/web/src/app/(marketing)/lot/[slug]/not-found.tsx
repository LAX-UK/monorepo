import { SegmentNotFound } from "@/components/marketing/segment-not-found";

export default function ArtworkNotFound() {
  return (
    <SegmentNotFound
      kicker="404 · Lot"
      title="This lot has been withdrawn"
      description="The lot may have been removed before the sale opened or the URL is incorrect. Browse the search index to discover similar work."
      primaryHref="/search"
      primaryLabel="Search lots"
      secondaryHref="/sales"
      secondaryLabel="Open calendar"
    />
  );
}
