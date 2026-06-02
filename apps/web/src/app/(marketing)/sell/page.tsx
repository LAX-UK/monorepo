import { LegalH2, LegalPage } from "@/components/marketing/legal-page";
import { PolicyHubLayout } from "@/components/marketing/policy-hub-layout";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForStatic({
  title: "Selling with LAX.BID",
  description:
    "How to sell with LAX.BID by London Art Exchange: submit a consignment, work with specialists, prepare catalogue materials, and settle after auction.",
  path: "/sell",
});

export default function SellPage() {
  const jsonLdText = jsonLdScript(
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Selling with LAX.BID", path: "/sell" },
    ]),
  );

  return (
    <PolicyHubLayout>
      <script type="application/ld+json" suppressHydrationWarning>
        {jsonLdText}
      </script>
      <LegalPage
        title="Selling with LAX.BID"
        lastUpdated="21 April 2026"
        kicker={null}
        dividerUnderDate
        embedded
      >
        <p>
          LAX.BID works with consignors to place fine art and exceptional objects into carefully
          edited online timed sales and in-person saleroom events. Our specialists guide each
          consignment from first review through catalogue, sale, payment, and settlement.
        </p>

        <LegalH2>What we accept</LegalH2>
        <p>
          We review editorial fine art and exceptional objects with clear provenance, condition
          information, and market fit for upcoming auctions. Share photographs, dimensions, artist
          or maker details, acquisition history, and any available documentation when you submit an
          item.
        </p>

        <LegalH2>How consignment works</LegalH2>
        <p>
          Start with a submission, then our team vets the object, confirms sale suitability,
          prepares catalogue materials, coordinates photography and logistics, and markets the lot
          to collectors. After the auction, we coordinate payment, buyer handover, and consignor
          settlement.
        </p>

        <LegalH2>Specialist support</LegalH2>
        <p>
          A small specialist desk leads each sale: a head of department vets consignments, a
          cataloguer writes condition notes, and a registrar coordinates payment, packing, and
          delivery. Every catalogue is reviewed by two specialists before publication.
        </p>

        <LegalH2>Fees &amp; timeline</LegalH2>
        <p>
          Fees, reserves, photography, storage, shipping, and settlement timing are agreed before a
          lot is entered into sale. The governing sale terms are available in our{" "}
          <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
            Conditions of Business
          </Link>
          .
        </p>

        <LegalH2>Get a valuation</LegalH2>
        <p>
          If you are ready to sell, start a submission with the key details and images. If you need
          to speak with a specialist first, contact our team and choose the selling topic so we can
          route your enquiry.
        </p>

        <p>
          Ready to proceed?{" "}
          <Link
            href="/dashboard/submissions/new"
            className="text-primary underline-offset-4 hover:underline"
          >
            Start a submission
          </Link>{" "}
          or{" "}
          <Link href="/contact" className="text-primary underline-offset-4 hover:underline">
            speak to a specialist
          </Link>
          .
        </p>
      </LegalPage>
    </PolicyHubLayout>
  );
}
