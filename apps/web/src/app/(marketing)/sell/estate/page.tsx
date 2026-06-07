import {
  SellTailoredLandingPage,
  sellTailoredPageMetadata,
} from "@/components/marketing/sell-tailored-landing-page";

export const metadata = sellTailoredPageMetadata({
  path: "/sell/estate",
  title: "Estate & collections",
  description:
    "Consign multiple works from an estate or family collection with specialist coordination for valuation and logistics.",
});

export default function SellEstatePage() {
  return (
    <SellTailoredLandingPage
      path="/sell/estate"
      breadcrumbLabel="Estate & collections"
      title="Estate & collections"
      description="Our estate desk coordinates inventory review, photography, storage, and sale scheduling across multiple works."
      eyebrow="Estate consignment"
      lead="Selling an estate or family collection? Share representative photos and an inventory list — our specialists will guide valuation, logistics, and sale planning."
      contactType="estate"
      bullets={[
        "Representative photographs of key works and any inventory spreadsheet you have",
        "Provenance summaries and certificates where available",
        "Location, access, and preferred timelines for collection review",
        "Single items can still be submitted directly through the standard wizard",
      ]}
    />
  );
}
