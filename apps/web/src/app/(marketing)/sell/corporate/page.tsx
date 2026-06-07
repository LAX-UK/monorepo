import {
  SellTailoredLandingPage,
  sellTailoredPageMetadata,
} from "@/components/marketing/sell-tailored-landing-page";

export const metadata = sellTailoredPageMetadata({
  path: "/sell/corporate",
  title: "Corporate disposals",
  description:
    "Office art, corporate collections, and deaccession programmes with compliance-aware specialist routing.",
});

export default function SellCorporatePage() {
  return (
    <SellTailoredLandingPage
      path="/sell/corporate"
      breadcrumbLabel="Corporate disposals"
      title="Corporate disposals"
      description="We support office art programmes, corporate collections, and deaccession projects with tailored logistics and compliance review."
      eyebrow="Corporate consignment"
      lead="Deaccessioning office art or a corporate collection? Tell us about locations, timelines, and any compliance requirements."
      contactType="corporate"
      bullets={[
        "Overview of collection size, locations, and disposal timeline",
        "Compliance or data-retention requirements we should know about",
        "Representative images and inventory where available",
        "Individual works can be submitted through the standard consignment wizard",
      ]}
    />
  );
}
