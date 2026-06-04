import { LegalH2, LegalPage } from "@/components/marketing/legal-page";
import {
  MARKETING_HUB_BREADCRUMB_CLASS,
  MarketingBreadcrumb,
} from "@/components/marketing/marketing-breadcrumb";
import { MarketingPromoCta } from "@/components/marketing/marketing-promo-cta";
import { PolicyHubLayout } from "@/components/marketing/policy-hub-layout";
import { MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { Button } from "@auction/ui";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForStatic({
  title: "Buying at LAX.BID",
  description:
    "How to buy at LAX.BID by London Art Exchange: browse auctions, register, verify your identity, bid, settle payment, and arrange shipping or collection.",
  path: "/buy",
});

export default function BuyPage() {
  const jsonLdText = jsonLdScript(
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Buying at LAX.BID", path: "/buy" },
    ]),
  );

  return (
    <PolicyHubLayout>
      <script type="application/ld+json" suppressHydrationWarning>
        {jsonLdText}
      </script>
      <LegalPage
        title="Buying at LAX.BID"
        breadcrumb={
          <MarketingBreadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Buying", current: true },
            ]}
            className={MARKETING_HUB_BREADCRUMB_CLASS}
          />
        }
        lastUpdated="21 April 2026"
        kicker={null}
        dividerUnderDate
        embedded
      >
        <p>
          Before you bid, create a LAX.BID account, set up your buyer profile, and accept our{" "}
          <Link href="/terms" className={MARKETING_PROSE_LINK}>
            Conditions of Business
          </Link>
          . Identity verification is required before bidding; complete it when prompted so you are
          ready when a sale opens.
        </p>

        <LegalH2>Browse &amp; preview</LegalH2>
        <p>
          Start with our{" "}
          <Link href="/" className={MARKETING_PROSE_LINK}>
            upcoming auctions
          </Link>
          , review{" "}
          <Link href="/archive" className={MARKETING_PROSE_LINK}>
            past sales
          </Link>
          , or search for specific works through the{" "}
          <Link href="/search" className={MARKETING_PROSE_LINK}>
            catalogue search
          </Link>
          . Artist pages and lot detail pages include estimates, images, provenance notes, and
          condition information where available; you can also explore{" "}
          <Link href="/artists" className={MARKETING_PROSE_LINK}>
            featured artists
          </Link>
          .
        </p>

        <LegalH2>Register your account</LegalH2>
        <p>
          Create an account before bidding. You must be 18 or over, provide accurate contact
          details, and agree to our{" "}
          <Link href="/terms" className={MARKETING_PROSE_LINK}>
            Conditions of Business
          </Link>
          . Registration lets our client services team support bidding, invoices, shipping, and
          after-sale queries in one place.
        </p>

        <LegalH2>Verify your identity</LegalH2>
        <p>
          Identity verification is required before you can bid. We use a regulated
          identity-verification partner for a short check, typically using a government ID and a
          selfie. You may be prompted during registration or when activity thresholds are reached.
          If you have trouble completing verification, contact our{" "}
          <Link href="/contact" className={MARKETING_PROSE_LINK}>
            client services team
          </Link>{" "}
          before the sale starts.
        </p>

        <LegalH2>Place a bid</LegalH2>
        <p>
          Once your account is registered and verification checks are complete, you can bid in{" "}
          <Link href="/sales" className={MARKETING_PROSE_LINK}>
            online timed sales
          </Link>{" "}
          through the website. In-person saleroom sales use paddle, telephone, or absentee
          participation — not web bidding. Review the lot page carefully before bidding, including
          estimates, condition notes, sale timing, and any location or collection details. For
          format differences and common bidding questions, visit our{" "}
          <Link href="/faq" className={MARKETING_PROSE_LINK}>
            FAQ
          </Link>
          .
        </p>

        <LegalH2>Buyer&apos;s premium &amp; costs</LegalH2>
        <p>
          Winning bidders pay the hammer price plus buyer&apos;s premium and any applicable taxes,
          shipping, insurance, or handling costs. The authoritative fee terms are published in our{" "}
          <Link href="/terms" className={MARKETING_PROSE_LINK}>
            Conditions of Business
          </Link>
          .
        </p>

        <LegalH2>Payment &amp; settlement</LegalH2>
        <p>
          After the sale, we issue an invoice with payment instructions and settlement timing. If
          you need help with payment, documentation, or buyer account details, contact{" "}
          <Link href="/contact" className={MARKETING_PROSE_LINK}>
            client services
          </Link>
          .
        </p>

        <LegalH2>Shipping &amp; collection</LegalH2>
        <p>
          Shipping and collection are arranged after payment. Fine art lots may require specialist
          packing, export documentation, and insured transit. Read our{" "}
          <Link href="/shipping" className={MARKETING_PROSE_LINK}>
            shipping and logistics
          </Link>{" "}
          guide before bidding if delivery timing or destination is important.
        </p>

        <p>
          Ready to begin?{" "}
          <Link href="/" className={MARKETING_PROSE_LINK}>
            Browse upcoming auctions
          </Link>{" "}
          or{" "}
          <Link href="/register" className={MARKETING_PROSE_LINK}>
            create an account
          </Link>
          .
        </p>

        <MarketingPromoCta
          className="mt-10"
          title="Ready to bid?"
          description="Browse live auctions or create an account to register and start bidding."
          actions={
            <>
              <Button variant="cta" asChild>
                <Link href="/sales">Browse auctions</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/register">Create account</Link>
              </Button>
            </>
          }
        />
      </LegalPage>
    </PolicyHubLayout>
  );
}
