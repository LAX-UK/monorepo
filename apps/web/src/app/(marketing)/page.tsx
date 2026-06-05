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
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { HOME_HERO_BLEED } from "@/lib/marketing/home-hero-layout";
import { resolveMarketingLayoutView } from "@/lib/preferences/resolve-marketing-layout-view.server";
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

function firstString(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return typeof v === "string" ? v : v[0];
}

async function MarketingHomeContent({
  urlView,
}: {
  urlView: string | undefined;
}) {
  const [data, session] = await Promise.all([getHomeData(), getServerSessionUser()]);
  const [layoutView, urgencyLayoutView] = await Promise.all([
    resolveMarketingLayoutView({
      routeKey: "home-upcoming",
      category: "sales",
      urlView,
      user: session,
      fallback: "grid",
    }),
    resolveMarketingLayoutView({
      routeKey: "home-urgency",
      category: "lots",
      urlView,
      user: session,
      fallback: "grid",
    }),
  ]);
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
      <div className={HOME_HERO_BLEED}>
        <LaxHero state={heroState} />
      </div>
      {urgencySection.variant !== "none" ? (
        <LaxUrgencySection
          variant={urgencySection.variant}
          items={urgencySection.lots}
          layoutView={urgencyLayoutView}
          isAuthenticated={isAuthenticated}
          watchedLotIds={watchedLotIds}
          loginNextPath="/"
        />
      ) : null}
      <LaxUpcomingAuctionsMarketing
        tiles={upcomingAuctionTiles}
        layoutView={layoutView}
        isAuthenticated={isAuthenticated}
      />
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

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const urlView = firstString(sp.view);

  return (
    <main id="main-content" className="bg-page-bg">
      <Suspense fallback={<HomeSkeleton />}>
        <MarketingHomeContent urlView={urlView} />
      </Suspense>
    </main>
  );
}
