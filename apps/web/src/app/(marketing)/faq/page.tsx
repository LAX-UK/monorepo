import { faqItems } from "@/components/marketing/faq/faq-data";
import { FaqFlatList } from "@/components/marketing/faq/faq-flat-list";
import { LegalPage } from "@/components/marketing/legal-page";
import { PolicyHubLayout } from "@/components/marketing/policy-hub-layout";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, faqPageJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForStatic({
  title: "FAQs",
  description: "Frequently asked questions about bidding, shipping, and accounts at LAX.",
  path: "/faq",
});

export default function FaqPage() {
  const jsonLdText = jsonLdScript(
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "FAQs", path: "/faq" },
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
        lastUpdated="21 April 2026"
        kicker={null}
        dividerUnderDate
        embedded
      >
        <FaqFlatList items={faqItems} />
      </LegalPage>
    </PolicyHubLayout>
  );
}
