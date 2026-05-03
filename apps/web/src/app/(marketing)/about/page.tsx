import { LegalH2, LegalPage } from "@/components/marketing/legal-page";
import { PolicyHubLayout } from "@/components/marketing/policy-hub-layout";
import { SITE_NAME } from "@/lib/brand";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForStatic({
  title: "About",
  description:
    "Learn about LAX London Auction House Ltd — editorial fine art auctions, specialist vetting, and white-glove bidding.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <PolicyHubLayout>
      <LegalPage
        title="About LAX"
        lastUpdated="21 April 2026"
        kicker={null}
        dividerUnderDate
        embedded
      >
        <p>
          {SITE_NAME} is an editorial auction house for fine art and exceptional objects — built for
          collectors who value provenance, discretion, and a calm bidding experience.
        </p>
        <p>
          Our specialists vet consignments, coordinate logistics, and support you from first bid
          through settlement. Every session is structured for clarity: transparent condition notes,
          published buyer&apos;s premium, and predictable timelines.
        </p>
        <LegalH2>Selling with us</LegalH2>
        <p>
          Consignors receive cataloguing, photography, and marketing placement across live and timed
          sales. Start with the contact form on our{" "}
          <Link href="/contact" className="text-primary underline-offset-4 hover:underline">
            Contact
          </Link>{" "}
          page — topic &quot;Selling&quot;.
        </p>
        <LegalH2>Registration</LegalH2>
        <p>
          Bidding requires a verified account. You must be 18 or over and agree to our{" "}
          <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
            Terms of sale
          </Link>
          .
        </p>
        <LegalH2>Our team</LegalH2>
        <p>
          A small specialist desk leads each sale: a head of department vets consignments, a
          cataloguer writes condition notes, and a registrar coordinates payment, packing, and
          delivery. Every catalogue is reviewed by two specialists before publication.
        </p>
        <LegalH2>Location</LegalH2>
        <p>
          12 Cork Street, Mayfair, London W1S 3LR
          <br />
          Tuesday – Saturday, 10:00 – 18:00 (viewings by appointment).
        </p>
      </LegalPage>
    </PolicyHubLayout>
  );
}
