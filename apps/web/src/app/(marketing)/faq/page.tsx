import { faqGroups, faqItems } from "@/components/marketing/faq/faq-data";
import { FaqFlatList } from "@/components/marketing/faq/faq-flat-list";
import { LegalPage } from "@/components/marketing/legal-page";
import {
  MARKETING_HUB_BREADCRUMB_CLASS,
  MarketingBreadcrumb,
} from "@/components/marketing/marketing-breadcrumb";
import { PolicyHubLayout } from "@/components/marketing/policy-hub-layout";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, faqPageJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForStatic({
  title: "Frequently Asked Questions",
  description:
    "Frequently asked questions about buying, selling, accounts, and support on LAX.BID by London Art Exchange.",
  path: "/faq",
});

export default function FaqPage() {
  const jsonLdText = jsonLdScript(
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "FAQ", path: "/faq" },
    ]),
    faqPageJsonLd(faqItems.map((item) => ({ question: item.title, answer: item.body }))),
  );
  return (
    <PolicyHubLayout>
      <script type="application/ld+json" suppressHydrationWarning>
        {jsonLdText}
      </script>
      <LegalPage
        title="Frequently Asked Questions"
        breadcrumb={
          <MarketingBreadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "FAQ", current: true },
            ]}
            className={MARKETING_HUB_BREADCRUMB_CLASS}
          />
        }
        lastUpdated="21 April 2026"
        kicker={null}
        dividerUnderDate
        embedded
        toc={faqGroups.map((group) => ({
          id: `faq-group-${group.id}`,
          label: group.title,
        }))}
      >
        <FaqFlatList groups={faqGroups} />
      </LegalPage>
    </PolicyHubLayout>
  );
}
