import { LegalH2, LegalPage } from "@/components/marketing/legal-page";
import { PolicyHubLayout } from "@/components/marketing/policy-hub-layout";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForStatic({
  title: "Buying at LAX",
  description:
    "How to buy at LAX: browse auctions, register, verify your identity, bid, settle payment, and arrange shipping or collection.",
  path: "/buy",
});

export default function BuyPage() {
  const jsonLdText = jsonLdScript(
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Buying at LAX", path: "/buy" },
    ]),
  );

  return (
    <PolicyHubLayout>
      <script type="application/ld+json" suppressHydrationWarning>
        {jsonLdText}
      </script>
      <LegalPage
        title="Buying at LAX"
        lastUpdated="21 April 2026"
        kicker={null}
        dividerUnderDate
        embedded
      >
        <p>
          Before you bid, make sure your account is ready: register with LAX, verify your identity,
          and accept our{" "}
          <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
            Terms of sale
          </Link>
          . Bids are only enabled once those checks are complete.
        </p>

        <LegalH2>Browse &amp; preview</LegalH2>
        <p>
          Start with our{" "}
          <Link href="/" className="text-primary underline-offset-4 hover:underline">
            upcoming auctions
          </Link>
          , review{" "}
          <Link href="/archive" className="text-primary underline-offset-4 hover:underline">
            past sales
          </Link>
          , or search for specific works through the{" "}
          <Link href="/search" className="text-primary underline-offset-4 hover:underline">
            catalogue search
          </Link>
          . Artist pages and lot detail pages include estimates, images, provenance notes, and
          condition information where available; you can also explore{" "}
          <Link href="/artist/featured" className="text-primary underline-offset-4 hover:underline">
            featured artists
          </Link>
          .
        </p>

        <LegalH2>Register your account</LegalH2>
        <p>
          Create an account before bidding. You must be 18 or over, provide accurate contact
          details, and agree to our{" "}
          <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
            Terms of sale
          </Link>
          . Registration lets our client services team support bidding, invoices, shipping, and
          after-sale queries in one place.
        </p>

        <LegalH2>Verify your identity</LegalH2>
        <p>
          Identity verification is required before you can bid. We use a regulated
          identity-verification partner for a short check, typically using a government ID and a
          selfie. If you have trouble completing verification, contact our{" "}
          <Link href="/contact" className="text-primary underline-offset-4 hover:underline">
            client services team
          </Link>{" "}
          before the sale starts.
        </p>

        <LegalH2>Place a bid</LegalH2>
        <p>
          Once your account is registered and your identity is verified, eligible bids can be placed
          in live and timed sales. Review the lot page carefully before bidding, including
          estimates, condition notes, sale timing, and any location or collection details. For
          common bidding questions, visit our{" "}
          <Link href="/faq" className="text-primary underline-offset-4 hover:underline">
            FAQ
          </Link>
          .
        </p>

        <LegalH2>Buyer&apos;s premium &amp; costs</LegalH2>
        <p>
          Winning bidders pay the hammer price plus buyer&apos;s premium and any applicable taxes,
          shipping, insurance, or handling costs. The authoritative fee terms are published in our{" "}
          <Link href="/terms" className="text-primary underline-offset-4 hover:underline">
            Terms of sale
          </Link>
          .
        </p>

        <LegalH2>Payment &amp; settlement</LegalH2>
        <p>
          After the sale, we issue an invoice with payment instructions and settlement timing. If
          you need help with payment, documentation, or buyer account details, contact{" "}
          <Link href="/contact" className="text-primary underline-offset-4 hover:underline">
            client services
          </Link>
          .
        </p>

        <LegalH2>Shipping &amp; collection</LegalH2>
        <p>
          Shipping and collection are arranged after payment. Fine art lots may require specialist
          packing, export documentation, and insured transit. Read our{" "}
          <Link href="/shipping" className="text-primary underline-offset-4 hover:underline">
            shipping and logistics
          </Link>{" "}
          guide before bidding if delivery timing or destination is important.
        </p>

        <p>
          Ready to begin?{" "}
          <Link href="/" className="text-primary underline-offset-4 hover:underline">
            Browse upcoming auctions
          </Link>{" "}
          or{" "}
          <Link href="/register" className="text-primary underline-offset-4 hover:underline">
            create an account
          </Link>
          .
        </p>
      </LegalPage>
    </PolicyHubLayout>
  );
}
