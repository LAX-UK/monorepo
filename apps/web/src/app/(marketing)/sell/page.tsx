import { LegalH2, LegalPage } from "@/components/marketing/legal-page";
import {
  MARKETING_HUB_BREADCRUMB_CLASS,
  MarketingBreadcrumb,
} from "@/components/marketing/marketing-breadcrumb";
import { PolicyHubLayout } from "@/components/marketing/policy-hub-layout";
import { SellCtaLink } from "@/components/marketing/sell-cta-link";
import { SellDepartmentsSection } from "@/components/marketing/sell-journey/sell-departments-section";
import { SellPhotosSection } from "@/components/marketing/sell-journey/sell-photos-section";
import { SellPrepareSection } from "@/components/marketing/sell-journey/sell-prepare-section";
import { SellProcessSection } from "@/components/marketing/sell-journey/sell-process-section";
import { SellValuationSection } from "@/components/marketing/sell-journey/sell-valuation-section";
import { SellPageClosingPromo } from "@/components/marketing/sell-page-closing-promo";
import { MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { SELL_PAGE_INTRO, SELL_TIME_EXPECTATIONS } from "@/lib/marketing/sell-flow-copy";
import { sellIntakeHref } from "@/lib/marketing/sell-intake";
import { SELL_PAGE_TOC } from "@/lib/marketing/sell-page-toc";
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
        breadcrumb={
          <MarketingBreadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Selling", current: true },
            ]}
            className={MARKETING_HUB_BREADCRUMB_CLASS}
          />
        }
        lastUpdated="21 April 2026"
        kicker="Consign with LAX"
        dividerUnderDate
        embedded
        toc={SELL_PAGE_TOC}
      >
        <p>{SELL_PAGE_INTRO}</p>
        <p>{SELL_TIME_EXPECTATIONS}</p>
        <p>
          Ready to begin?{" "}
          <SellCtaLink href={sellIntakeHref()} source="sell_intro" className={MARKETING_PROSE_LINK}>
            Start your submission
          </SellCtaLink>{" "}
          — create an account and complete the wizard in about 3 minutes.
        </p>

        <LegalH2 id="departments" className="scroll-mt-28">
          What we accept
        </LegalH2>
        <SellDepartmentsSection />

        <LegalH2 id="how-it-works" className="scroll-mt-28">
          How consignment works
        </LegalH2>
        <SellProcessSection />

        <LegalH2 id="prepare" className="scroll-mt-28">
          Prepare your submission
        </LegalH2>
        <SellPrepareSection />

        <LegalH2 id="photos" className="scroll-mt-28">
          Photographing your item
        </LegalH2>
        <SellPhotosSection />

        <LegalH2 id="fees" className="scroll-mt-28">
          Fees &amp; specialist support
        </LegalH2>
        <p>
          Fees, reserves, photography, storage, shipping, and settlement timing are agreed before a
          lot is entered into sale. The governing sale terms are available in our{" "}
          <Link href="/terms" className={MARKETING_PROSE_LINK}>
            Conditions of Business
          </Link>
          .
        </p>
        <p>
          A small specialist desk leads each sale: a head of department vets consignments, a
          cataloguer writes condition notes, and a registrar coordinates payment, packing, and
          delivery. Every catalogue is reviewed by two specialists before publication.
        </p>

        <LegalH2 id="valuation" className="scroll-mt-28">
          Get a valuation
        </LegalH2>
        <SellValuationSection />

        <SellPageClosingPromo />
      </LegalPage>
    </PolicyHubLayout>
  );
}
