import { AppNotFound } from "@/components/app/app-not-found";

export default function SaleNotFound() {
  return (
    <AppNotFound
      kicker="404 · Sale"
      title="This sale isn't in the catalogue"
      description="The sale may have ended, been withdrawn, or never been published. Browse upcoming and past sales in the calendar."
      primaryHref="/sales"
      primaryLabel="Open calendar"
      secondaryHref="/"
      secondaryLabel="Back to gallery"
      searchHref="/search"
      illustration="sales"
      siteHeaderOffset
    />
  );
}
