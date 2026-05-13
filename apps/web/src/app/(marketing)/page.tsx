import { LaxEditorsPicksMarketing } from "@/components/sections/home/editors-picks-marketing/lax-editors-picks-marketing";
import { getHomeData } from "@/components/sections/home/get-home-data";
import { HomeNewsletter } from "@/components/sections/home/home-newsletter";
import { LaxConsignCTA } from "@/components/sections/home/lax-consign-cta";
import { LaxEndingSoon } from "@/components/sections/home/lax-ending-soon";
import { LaxHero } from "@/components/sections/home/lax-hero";
import { LaxPrivateSaleHighlightsMarketing } from "@/components/sections/home/private-sale-highlights-marketing/lax-private-sale-highlights-marketing";
import { HomeSkeleton } from "@/components/sections/home/skeletons/home-skeleton";
import { LaxUpcomingAuctionsMarketing } from "@/components/sections/home/upcoming-auctions-marketing/lax-upcoming-auctions-marketing";
import { SITE_TAGLINE } from "@/lib/brand";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { itemListJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { getSiteUrl } from "@/lib/site-url";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = metadataForStatic({
  title: "Fine art auctions",
  description: SITE_TAGLINE,
  path: "/",
});

export const revalidate = 60;

async function MarketingHomeContent() {
  const data = await getHomeData();
  const {
    heroState,
    jsonLdListFallback,
    endingSoonLots,
    upcomingAuctionTiles,
    editorsPickLots,
    privateSaleHighlights,
  } = data;
  const base = getSiteUrl();
  const listForJsonLd =
    upcomingAuctionTiles.length > 0
      ? upcomingAuctionTiles
      : jsonLdListFallback.length > 0
        ? jsonLdListFallback
        : [];
  const homeListJsonLd =
    listForJsonLd.length > 0
      ? itemListJsonLd(
          listForJsonLd.map((entry) => ({
            name: entry.title,
            url: `${base}${entry.href.startsWith("/") ? entry.href : `/${entry.href}`}`,
          })),
        )
      : null;

  return (
    <>
      {homeListJsonLd ? (
        <script type="application/ld+json" suppressHydrationWarning>
          {jsonLdScript(homeListJsonLd)}
        </script>
      ) : null}
      <LaxHero state={heroState} />
      <LaxEndingSoon items={endingSoonLots} />
      <LaxUpcomingAuctionsMarketing tiles={upcomingAuctionTiles} />
      <LaxEditorsPicksMarketing lots={editorsPickLots} />
      <LaxPrivateSaleHighlightsMarketing highlights={privateSaleHighlights} />
      <LaxConsignCTA />
      <HomeNewsletter />
    </>
  );
}

export default function HomePage() {
  return (
    <main id="main-content" className="bg-page-bg pt-[var(--header-height)]">
      <Suspense fallback={<HomeSkeleton />}>
        <MarketingHomeContent />
      </Suspense>
    </main>
  );
}
