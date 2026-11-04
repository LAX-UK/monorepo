import { faqGroups } from "@/components/marketing/faq/faq-data";
import { SellLandingView } from "@/components/marketing/sell/sell-landing-view";
import { SellLegacyAnchorRedirect } from "@/components/marketing/sell/sell-legacy-anchor-redirect";
import { SITE_SEO_NAME } from "@/lib/brand";
import { loadRecentlySold } from "@/lib/marketing/load-recently-sold";
import { SELL_FAQ_IDS, SELL_HERO_TITLE } from "@/lib/marketing/sell-landing";
import { SELL_SPECIALISTS } from "@/lib/marketing/sell-specialists";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForStatic({
  title: SELL_HERO_TITLE,
  description: `Sell with ${SITE_SEO_NAME}: free valuations from our specialists, no obligation to sell, and a payout after the buyer has paid.`,
  path: "/sell",
});

const FAQ_ITEMS = faqGroups
  .flatMap((group) => (group.id === "selling" ? group.items : []))
  .filter((item) => (SELL_FAQ_IDS as readonly string[]).includes(item.id))
  .sort((a, b) => SELL_FAQ_IDS.indexOf(a.id as never) - SELL_FAQ_IDS.indexOf(b.id as never));

export default async function SellPage() {
  const recentlySold = await loadRecentlySold();
  const jsonLdText = jsonLdScript(
    breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Sell", path: "/sell" },
    ]),
  );

  return (
    <>
      <script type="application/ld+json" suppressHydrationWarning>
        {jsonLdText}
      </script>
      <SellLegacyAnchorRedirect />
      <SellLandingView
        recentlySold={recentlySold.ok ? recentlySold.value : []}
        specialists={SELL_SPECIALISTS}
        faqItems={FAQ_ITEMS}
      />
    </>
  );
}
