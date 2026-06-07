import {
  SellTailoredLandingPage,
  sellTailoredPageMetadata,
} from "@/components/marketing/sell-tailored-landing-page";

export const metadata = sellTailoredPageMetadata({
  path: "/sell/watches",
  title: "Watches & clocks",
  description:
    "Consign wristwatches, pocket watches, and clocks with reference details, box and papers, and specialist-ready photographs.",
});

export default function SellWatchesPage() {
  return (
    <SellTailoredLandingPage
      path="/sell/watches"
      breadcrumbLabel="Watches & clocks"
      title="Watches & clocks"
      description="Our watch specialists review reference numbers, condition, and supporting documentation before catalogue preparation."
      eyebrow="Watches & clocks"
      lead="Selling a wristwatch, pocket watch, or clock? Share reference details, box and papers where available, and clear photographs of the dial, caseback, and movement."
      categorySlug="watches-clocks"
      bullets={[
        "Reference number, case material, and bracelet or strap",
        "Dial, caseback, movement, and serial markings",
        "Box, papers, and service history in your submitter notes",
        "Overall and detail photographs — avoid heavy filters or glare",
        "Single watches can be submitted through the standard wizard in about 3 minutes",
      ]}
    />
  );
}
