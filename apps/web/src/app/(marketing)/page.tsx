import { LaxEditorsPicksMarketing } from "@/components/sections/home/editors-picks-marketing/lax-editors-picks-marketing";
import { getHomeData } from "@/components/sections/home/get-home-data";
import { HomeNewsletter } from "@/components/sections/home/home-newsletter";
import { LaxConsignCTA } from "@/components/sections/home/lax-consign-cta";
import { LaxHero } from "@/components/sections/home/lax-hero";
import { LaxUrgencySection } from "@/components/sections/home/lax-urgency-section";
import { LaxPrivateSaleHighlightsMarketing } from "@/components/sections/home/private-sale-highlights-marketing/lax-private-sale-highlights-marketing";
import { HomeSkeleton } from "@/components/sections/home/skeletons/home-skeleton";
import { LaxUpcomingAuctionsMarketing } from "@/components/sections/home/upcoming-auctions-marketing/lax-upcoming-auctions-marketing";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/brand";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import {
  breadcrumbJsonLd,
  homeUpcomingItemListJsonLd,
  itemListJsonLd,
  jsonLdScript,
  webPageJsonLd,
} from "@/lib/seo/structured-data";
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
    urgencySection,
    upcomingAuctionTiles,
    upcomingSales,
    editorsPickLots,
    privateSaleHighlights,
    isAuthenticated,
    watchedLotIds,
  } = data;
  const base = getSiteUrl().replace(/\/$/, "");
  const homeUrl = `${base}/`;
  const breadcrumbId = `${homeUrl}#breadcrumb`;

  const primaryListLd =
    upcomingSales.length > 0
      ? homeUpcomingItemListJsonLd(upcomingSales)
      : jsonLdListFallback.length > 0
        ? itemListJsonLd(
            jsonLdListFallback.map((entry) => ({
              name: entry.title,
              url: `${base}${entry.href.startsWith("/") ? entry.href : `/${entry.href}`}`,
            })),
          )
        : null;

  const structuredData = jsonLdScript(
    webPageJsonLd({
      url: homeUrl,
      name: SITE_NAME,
      description: SITE_TAGLINE,
      breadcrumbId,
    }),
    breadcrumbJsonLd([{ name: "Home", path: "/" }], { graphId: breadcrumbId }),
    primaryListLd,
  );

  return (
    <>
      {structuredData !== "{}" ? (
        <script type="application/ld+json" suppressHydrationWarning>
          {structuredData}
        </script>
      ) : null}
      <LaxHero state={heroState} />
      {urgencySection.variant !== "none" ? (
        <LaxUrgencySection
          variant={urgencySection.variant}
          items={urgencySection.lots}
          isAuthenticated={isAuthenticated}
          watchedLotIds={watchedLotIds}
          loginNextPath="/"
        />
      ) : null}
      <LaxUpcomingAuctionsMarketing tiles={upcomingAuctionTiles} />
      <LaxEditorsPicksMarketing
        lots={editorsPickLots}
        isAuthenticated={isAuthenticated}
        watchedLotIds={watchedLotIds}
        loginNextPath="/"
      />
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
