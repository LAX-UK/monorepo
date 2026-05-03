import { SegmentNotFound } from "@/components/marketing/segment-not-found";

export default function MarketingNotFound() {
  return (
    <SegmentNotFound
      kicker="404"
      title="This page isn't in the gallery"
      description="The page you requested may have moved or never existed. Browse the calendar or return home to keep exploring."
      primaryHref="/"
      primaryLabel="Back to gallery"
      secondaryHref="/sales"
      secondaryLabel="Open calendar"
    />
  );
}
