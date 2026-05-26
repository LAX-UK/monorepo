import { AppNotFound } from "@/components/app/app-not-found";

export default function ArtistNotFound() {
  return (
    <AppNotFound
      kicker="404 · Artist"
      title="We don't have a profile for this artist"
      description="The profile may have been removed or the URL is incorrect. Browse featured artists for curated profiles."
      primaryHref="/artists/featured"
      primaryLabel="Featured artists"
      secondaryHref="/"
      secondaryLabel="Back to gallery"
      searchHref="/search"
      illustration="users"
      siteHeaderOffset
    />
  );
}
