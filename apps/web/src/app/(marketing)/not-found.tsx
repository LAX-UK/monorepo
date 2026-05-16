import { SegmentNotFound } from "@/components/marketing/segment-not-found";
import { metadataForNotFound } from "@/lib/seo/metadata-factory";

export const metadata = metadataForNotFound(
  "Page not found",
  "The page you requested may have moved or never existed.",
);

export default function MarketingNotFound() {
  return (
    <main id="main-content">
      <SegmentNotFound
        kicker="404"
        title="This page isn't in the gallery"
        description="The page you requested may have moved or never existed. Browse the calendar or return home to keep exploring."
        primaryHref="/"
        primaryLabel="Back to gallery"
        secondaryHref="/sales"
        secondaryLabel="Open calendar"
      />
    </main>
  );
}
