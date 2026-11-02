import { EditorsPicksMarketingClient } from "@/components/sections/home/editors-picks-marketing/editors-picks-marketing-client";
import { getHomeData } from "@/components/sections/home/get-home-data";
import { HomeAlertsNotice } from "@/components/sections/home/home-alerts-notice";
import { HomeCover } from "@/components/sections/home/home-cover";
import { HomeHangSection } from "@/components/sections/home/home-hang/home-hang-section";
import { HomeNewsletter } from "@/components/sections/home/home-newsletter";
import { LaxConsignCTA } from "@/components/sections/home/lax-consign-cta";
import { LaxUrgencySection } from "@/components/sections/home/lax-urgency-section";
import { HomeSkeleton } from "@/components/sections/home/skeletons/home-skeleton";
import { UpcomingAuctionsMarketingClient } from "@/components/sections/home/upcoming-auctions-marketing/upcoming-auctions-marketing-client";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/brand";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import {
  COVER_ALERTS_PARAM,
  parseCoverAlertsOutcome,
} from "@/lib/marketing-cover/cover-alerts-outcome";
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
  alerts,
}: {
  urlView: string | undefined;
  alerts: string | undefined;
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
    homeState,
    cover,
    jsonLdListFallback,
    urgencySection,
    upcomingAuctionTiles,
    upcomingSales,
    moreLots,
    hang,
    isAuthenticated,
    watchedLotIds,
  } = data;
  const alertsOutcome = parseCoverAlertsOutcome(alerts);
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
      {alertsOutcome ? <HomeAlertsNotice outcome={alertsOutcome} /> : null}
      <HomeCover slides={cover.slides} leadSale={cover.leadSale} signedIn={isAuthenticated} />
      <HomeHangSection hang={hang} />
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
      {upcomingAuctionTiles.length > 0 ? (
        <UpcomingAuctionsMarketingClient
          tiles={upcomingAuctionTiles}
          layoutView={layoutView}
          isAuthenticated={isAuthenticated}
        />
      ) : null}
      {moreLots.length > 0 ? (
        <EditorsPicksMarketingClient
          lots={moreLots}
          isAuthenticated={isAuthenticated}
          watchedLotIds={watchedLotIds}
          loginNextPath="/"
        />
      ) : null}
      <LaxConsignCTA />
      {/* The between-seasons cover already carries the sign-up. */}
      {homeState.state !== "betweenSeasons" ? <HomeNewsletter /> : null}
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
  const alerts = firstString(sp[COVER_ALERTS_PARAM]);

  return (
    <div className="bg-page-bg pt-[var(--header-height)]">
      <Suspense fallback={<HomeSkeleton />}>
        <MarketingHomeContent urlView={urlView} alerts={alerts} />
      </Suspense>
    </div>
  );
}
