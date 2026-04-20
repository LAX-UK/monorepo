import { LegalPage } from "@/components/marketing/legal-page";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForStatic({
  title: "About",
  description:
    "Learn about LAX London Auction House Ltd — editorial fine art auctions, specialist vetting, and white-glove bidding.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <LegalPage title="About">
      <p>
        LAX London Auction House Ltd is an editorial auction house for fine art and exceptional
        objects—built for collectors who value provenance, discretion, and a calm bidding
        experience.
      </p>
      <p>
        Our specialists vet consignments, coordinate logistics, and support you from first bid
        through settlement.
      </p>
    </LegalPage>
  );
}
