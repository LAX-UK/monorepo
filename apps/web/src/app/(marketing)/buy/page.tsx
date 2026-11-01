import { BuyJourneySection } from "@/components/marketing/buy-journey-section";
import { LegalPage } from "@/components/marketing/legal-page";
import {
  MARKETING_HUB_BREADCRUMB_CLASS,
  MarketingBreadcrumb,
} from "@/components/marketing/marketing-breadcrumb";
import { MarketingPromoCta } from "@/components/marketing/marketing-promo-cta";
import { PolicyHubLayout } from "@/components/marketing/policy-hub-layout";
import { buildHostedLoginStartHref } from "@/lib/auth/hosted-login-start-href";
import { SITE_SEO_NAME } from "@/lib/brand";
import { MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { MarketingSectionReveal } from "@auction/marketing-ui";
import { ButtonLink } from "@auction/ui/lax";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForStatic({
  title: "Buying at LAX.BID",
  description: `How to buy at ${SITE_SEO_NAME}: browse auctions, register, verify your identity, bid, settle payment, and arrange shipping or collection.`,
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
        kicker="How to buy"
        embedded
      >
        <p>
          Before you bid, create a LAX.BID account, set up your buyer profile, and accept our{" "}
          <Link href="/terms" className={MARKETING_PROSE_LINK}>
            Conditions of Business
          </Link>
          . Identity verification may be required as your bidding activity increases; complete it
          when prompted so you are ready when a sale opens.
        </p>

        <MarketingPromoCta
          className="mt-8"
          title="Ready to bid?"
          description="Create an account to register and start bidding, or browse upcoming auctions."
          actions={
            <>
              <ButtonLink variant="primary" href={buildHostedLoginStartHref({ intent: "signup" })}>
                Create account
              </ButtonLink>
              <ButtonLink Link={Link} variant="secondary" href="/sales">
                Browse auctions
              </ButtonLink>
            </>
          }
        />

        <div className="mt-10 space-y-6">
          <h2 className="font-headline text-[length:var(--text-display-sm)] font-semibold text-on-surface">
            How buying works
          </h2>
          <MarketingSectionReveal index={0}>
            <BuyJourneySection />
          </MarketingSectionReveal>
        </div>

        <MarketingPromoCta
          className="mt-10"
          title="Questions before you bid?"
          description="Browse the FAQ or contact client services if you need help with registration or verification."
          actions={
            <>
              <ButtonLink Link={Link} variant="primary" href="/sales">
                Browse auctions
              </ButtonLink>
              <ButtonLink Link={Link} variant="secondary" href="/faq">
                View FAQ
              </ButtonLink>
            </>
          }
        />
      </LegalPage>
    </PolicyHubLayout>
  );
}
