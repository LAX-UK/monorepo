import { LegalPage } from "@/components/marketing/legal-page";
import {
  MARKETING_HUB_BREADCRUMB_CLASS,
  MarketingBreadcrumb,
} from "@/components/marketing/marketing-breadcrumb";
import { MarketingPromoCta } from "@/components/marketing/marketing-promo-cta";
import { MarketingSectionSubheading } from "@/components/marketing/marketing-section-subheading";
import { PolicyHubLayout } from "@/components/marketing/policy-hub-layout";
import { SellCtaLink } from "@/components/marketing/sell-cta-link";
import { MARKETING_PROSE_LINK } from "@/lib/marketing/chrome";
import { sellIntakeHref } from "@/lib/marketing/sell-intake";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";

type Props = {
  path: "/sell/estate" | "/sell/corporate" | "/sell/prints" | "/sell/watches" | "/sell/motor-cars";
  title: string;
  description: string;
  eyebrow: string;
  lead: string;
  bullets: readonly string[];
  breadcrumbLabel: string;
  /** Pre-select category when starting the submission wizard. */
  categorySlug?: string;
};

export function sellTailoredPageMetadata({
  path,
  title,
  description,
}: Pick<Props, "path" | "title" | "description">): Metadata {
  return metadataForStatic({ title, description, path });
}

export function SellTailoredLandingPage({
  path,
  title,
  description,
  eyebrow,
  lead,
  bullets,
  categorySlug,
  breadcrumbLabel,
}: Props) {
  const jsonLdText = jsonLdScript(
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Selling with LAX.BID", path: "/sell" },
      { name: breadcrumbLabel, path },
    ]),
  );

  return (
    <PolicyHubLayout>
      <script type="application/ld+json" suppressHydrationWarning>
        {jsonLdText}
      </script>
      <LegalPage
        title={title}
        breadcrumb={
          <MarketingBreadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Selling", href: "/sell" },
              { label: breadcrumbLabel, current: true },
            ]}
            className={MARKETING_HUB_BREADCRUMB_CLASS}
          />
        }
        kicker={eyebrow}
        embedded
      >
        <p>{lead}</p>
        <p>{description}</p>

        <div className="mt-8 rounded-lg border border-border-hairline bg-surface-container-lowest p-6">
          <MarketingSectionSubheading>What to prepare</MarketingSectionSubheading>
          <ul className="mt-4 space-y-3">
            {bullets.map((item) => (
              <li key={item} className="font-body text-sm text-on-surface-variant">
                {item}
              </li>
            ))}
          </ul>
        </div>

        <MarketingPromoCta
          className="mt-8"
          title="Ready to begin?"
          description="Create an account and start your submission — our specialists review every item within 24 hours."
          actions={
            <Button variant="cta" asChild>
              <SellCtaLink
                href={sellIntakeHref(categorySlug ? { categorySlug } : undefined)}
                source={`${path}_submit`}
              >
                Start your submission
              </SellCtaLink>
            </Button>
          }
        />

        <p className="mt-6 font-body text-sm text-on-surface-variant">
          Back to{" "}
          <Link href="/sell" className={MARKETING_PROSE_LINK}>
            Selling with LAX
          </Link>
        </p>
      </LegalPage>
    </PolicyHubLayout>
  );
}
