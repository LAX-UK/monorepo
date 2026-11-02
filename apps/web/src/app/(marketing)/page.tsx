import { getHomeData } from "@/components/sections/home/get-home-data";
import { HomeAlertsNotice } from "@/components/sections/home/home-alerts-notice";
import { HomeCover } from "@/components/sections/home/home-cover";
import { HomeHangSection } from "@/components/sections/home/home-hang/home-hang-section";
import { HomeSectionsView } from "@/components/sections/home/sections/home-sections-view";
import { HomeSkeleton } from "@/components/sections/home/skeletons/home-skeleton";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/brand";
import {
  COVER_ALERTS_PARAM,
  parseCoverAlertsOutcome,
} from "@/lib/marketing-cover/cover-alerts-outcome";
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

async function MarketingHomeContent({ alerts }: { alerts: string | undefined }) {
  const data = await getHomeData();
  const {
    homeState,
    cover,
    jsonLdListFallback,
    sections,
    upcomingSales,
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
      <HomeSectionsView
        homeState={homeState}
        sections={sections}
        watch={{ isAuthenticated, watchedLotIds }}
      />
    </>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const alerts = firstString(sp[COVER_ALERTS_PARAM]);

  return (
    <div className="bg-page-bg pt-[var(--header-height)]">
      <Suspense fallback={<HomeSkeleton />}>
        <MarketingHomeContent alerts={alerts} />
      </Suspense>
    </div>
  );
}
