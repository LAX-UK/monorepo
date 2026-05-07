import { getHomeData } from "@/components/sections/home/get-home-data";
import { HomeNewsletter } from "@/components/sections/home/home-newsletter";
import { LaxArtists } from "@/components/sections/home/lax-artists";
import { LaxEditorialStrip } from "@/components/sections/home/lax-editorial-strip";
import { LaxHero } from "@/components/sections/home/lax-hero";
import { LaxUpcomingAuctions } from "@/components/sections/home/lax-upcoming-auctions";
import { LaxUpcomingLots } from "@/components/sections/home/lax-upcoming-lots";
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
  const { heroState, lotCards, auctionVm, artistCards, saleMetaLine } = await getHomeData();
  const base = getSiteUrl();
  const upcomingLotsJsonLd =
    lotCards.length > 0
      ? itemListJsonLd(
          lotCards.map((lot) => ({
            name: lot.title,
            url: `${base}${lot.href.startsWith("/") ? lot.href : `/${lot.href}`}`,
          })),
        )
      : null;

  return (
    <>
      {upcomingLotsJsonLd ? (
        <script type="application/ld+json" suppressHydrationWarning>
          {jsonLdScript(upcomingLotsJsonLd)}
        </script>
      ) : null}
      <LaxHero state={heroState} />
      <LaxUpcomingLots items={lotCards} saleMetaLine={saleMetaLine} />
      <LaxUpcomingAuctions auction={auctionVm} />
      <LaxArtists items={artistCards} />
      <LaxEditorialStrip />
      <HomeNewsletter />
    </>
  );
}

export default function HomePage() {
  return (
    <main id="main-content" className="bg-page-bg pt-[var(--header-height)]">
      <Suspense
        fallback={
          <div
            className="min-h-[min(100svh,520px)] w-full animate-pulse bg-surface-container-low md:min-h-[min(100svh,760px)]"
            aria-hidden
          />
        }
      >
        <MarketingHomeContent />
      </Suspense>
    </main>
  );
}
