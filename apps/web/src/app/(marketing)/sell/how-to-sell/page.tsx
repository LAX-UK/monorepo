import { LegalH2, LegalPage } from "@/components/marketing/legal-page";
import {
  MARKETING_HUB_BREADCRUMB_CLASS,
  MarketingBreadcrumb,
} from "@/components/marketing/marketing-breadcrumb";
import { SellPhotosSection } from "@/components/marketing/sell-journey/sell-photos-section";
import { SellPrepareSection } from "@/components/marketing/sell-journey/sell-prepare-section";
import { SellProcessSection } from "@/components/marketing/sell-journey/sell-process-section";
import { SellValuationSection } from "@/components/marketing/sell-journey/sell-valuation-section";
import { SellClosingCta } from "@/components/marketing/sell/sell-closing-cta";
import { SITE_SEO_NAME } from "@/lib/brand";
import { MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { SELL_PAGE_INTRO } from "@/lib/marketing/sell-flow-copy";
import { SELL_HOW_TO_SELL_PATH } from "@/lib/marketing/sell-landing";
import { SELL_PAGE_TOC } from "@/lib/marketing/sell-page-toc";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { MarketingSectionReveal } from "@auction/marketing-ui";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForStatic({
  title: "How to sell, step by step",
  description: `How to sell with ${SITE_SEO_NAME}: what to prepare, how to photograph your work, and what happens from first review to payment.`,
  path: SELL_HOW_TO_SELL_PATH,
});

export default function HowToSellPage() {
  const jsonLdText = jsonLdScript(
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Sell", path: "/sell" },
      { name: "How to sell", path: SELL_HOW_TO_SELL_PATH },
    ]),
  );

  return (
    <>
      <script type="application/ld+json" suppressHydrationWarning>
        {jsonLdText}
      </script>
      <div className="bg-page-bg pt-[calc(var(--header-height)+1.5rem)] pb-16 dark:bg-background">
        <div className="mx-auto w-full max-w-[var(--container-max,1440px)] px-4 md:px-6">
          <LegalPage
            embedded
            title="How to sell, step by step"
            breadcrumb={
              <MarketingBreadcrumb
                items={[
                  { label: "Home", href: "/" },
                  { label: "Sell", href: "/sell" },
                  { label: "How to sell", current: true },
                ]}
                className={MARKETING_HUB_BREADCRUMB_CLASS}
              />
            }
            kicker={null}
            toc={SELL_PAGE_TOC}
          >
            <p>{SELL_PAGE_INTRO}</p>
            <p>
              What we sell, what it costs and who we are is on the{" "}
              <Link href="/sell" className={MARKETING_PROSE_LINK}>
                selling page
              </Link>
              .
            </p>

            <LegalH2 id="how-it-works" className="scroll-mt-28 mt-10">
              How consignment works
            </LegalH2>
            <MarketingSectionReveal index={0}>
              <SellProcessSection />
            </MarketingSectionReveal>

            <LegalH2 id="prepare" className="scroll-mt-28">
              Prepare your submission
            </LegalH2>
            <MarketingSectionReveal index={1}>
              <SellPrepareSection />
            </MarketingSectionReveal>

            <LegalH2 id="photos" className="scroll-mt-28">
              Photographing your item
            </LegalH2>
            <MarketingSectionReveal index={2}>
              <SellPhotosSection />
            </MarketingSectionReveal>

            <LegalH2 id="valuation" className="scroll-mt-28">
              Get a valuation
            </LegalH2>
            <MarketingSectionReveal index={3}>
              <SellValuationSection />
            </MarketingSectionReveal>

            <SellClosingCta source="sell_how_to_sell" className="mt-12" />
          </LegalPage>
        </div>
      </div>
    </>
  );
}
