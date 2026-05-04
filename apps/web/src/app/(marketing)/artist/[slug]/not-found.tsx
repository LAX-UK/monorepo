import { SegmentNotFound } from "@/components/marketing/segment-not-found";

export default function ArtistNotFound() {
  return (
    <SegmentNotFound
      kicker="404 · Artist"
      title="We don't have a profile for this artist"
      description="The profile may have been removed or the URL is incorrect. Browse featured artists for curated profiles."
      primaryHref="/artist/featured"
      primaryLabel="Featured artists"
      secondaryHref="/"
      secondaryLabel="Back to gallery"
    />
  );
}
