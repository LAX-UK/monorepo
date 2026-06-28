import { MarketingCatalogHubShell } from "@/components/marketing/marketing-catalog-hub-shell";
import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import {
  mapPressArchiveEntryToVM,
  mapPressDayMediaSaleToVM,
} from "@/components/sections/press/mappers";
import { PressCoverageList } from "@/components/sections/press/press-coverage-list";
import { PressDayMediaRail } from "@/components/sections/press/press-day-media-rail";
import { PressHubHero } from "@/components/sections/press/press-hub-hero";
import { PressMediaKitBlock } from "@/components/sections/press/press-media-kit-block";
import { PressPageToolbar } from "@/components/sections/press/press-page-toolbar";
import { PressPagination } from "@/components/sections/press/press-pagination";
import { getServerPressArchiveReader } from "@/lib/data/http/press.server";
import {
  PRESS_HUB_PAGE_SIZE,
  buildPressHubClampedPageQuery,
  countActivePressHubFilters,
  parsePressHubParams,
  pressHubHasNonCanonicalState,
  pressHubOffset,
  pressHubPageOutOfRange,
  pressHubTotalPages,
} from "@/lib/marketing/press-params";
import { metadataForPressHub } from "@/lib/seo/metadata-factory";
import { pressHubJsonLd } from "@/lib/seo/press/jsonld";
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { salePath } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const params = parsePressHubParams(sp);
  return metadataForPressHub({
    ...(params.q ? { searchQuery: params.q } : {}),
    ...(params.year != null ? { year: params.year } : {}),
    noIndex: pressHubHasNonCanonicalState(params),
  });
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PressPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const params = parsePressHubParams(sp);
  const reader = getServerPressArchiveReader();
  const offset = pressHubOffset(params);
  const hasActiveFilters = countActivePressHubFilters(params) > 0;
  const nonCanonical = pressHubHasNonCanonicalState(params);

  const [coverageResult, dayMediaSales] = await Promise.all([
    reader.list({
      limit: PRESS_HUB_PAGE_SIZE,
      offset,
      ...(params.year != null ? { year: params.year } : {}),
      ...(params.q ? { q: params.q } : {}),
    }),
    reader.listDayMediaSales(24),
  ]);

  const { data, meta, unavailable } = coverageResult;

  if (pressHubPageOutOfRange(params, meta.total)) {
    redirect(buildPressHubClampedPageQuery(params, meta.total));
  }

  const coverageItems = data.map((entry) => mapPressArchiveEntryToVM(entry, salePath));
  const dayMediaItems = dayMediaSales.map((sale) => mapPressDayMediaSaleToVM(sale, salePath));
  const years = meta.availableYears;
  const totalPages = pressHubTotalPages(meta.total);
  const includeItemList = !nonCanonical && params.page === 1 && data.length > 0;

  const base = getSiteUrl();
  const crumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Press", path: "/press" },
  ]);
  const hubLd = pressHubJsonLd({
    url: `${base}/press`,
    entries: includeItemList ? data : [],
    lastUpdated: meta.lastUpdated,
    totalItems: meta.total,
    includeItemList,
  });
  const jsonLdText = jsonLdScript(crumbs, hubLd);

  if (unavailable) {
    return (
      <MarketingCatalogHubShell
        hero={<PressHubHero lastUpdated={null} />}
        jsonLd={
          <script type="application/ld+json" suppressHydrationWarning>
            {jsonLdText}
          </script>
        }
      >
        <MarketingEmptyState
          variant="marketing"
          context="error"
          title="Press centre temporarily unavailable"
          description="We couldn't load press coverage right now. Please try again in a moment."
          action={
            <>
              <Button variant="cta" asChild>
                <Link href="/press">Try again</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">Back to home</Link>
              </Button>
            </>
          }
        />
      </MarketingCatalogHubShell>
    );
  }

  return (
    <MarketingCatalogHubShell
      hero={<PressHubHero lastUpdated={meta.lastUpdated} />}
      footer={
        totalPages > 1 ? (
          <Suspense fallback={null}>
            <PressPagination page={params.page} totalPages={totalPages} />
          </Suspense>
        ) : null
      }
      jsonLd={
        <script type="application/ld+json" suppressHydrationWarning>
          {jsonLdText}
        </script>
      }
    >
      <div className="flex flex-col gap-12">
        <section id="press-coverage" aria-labelledby="press-coverage-archive-title">
          <PressCoverageList
            items={coverageItems}
            hasActiveFilters={hasActiveFilters}
            toolbar={<PressPageToolbar params={params} years={years} resultCount={meta.total} />}
          />
        </section>

        <PressDayMediaRail items={dayMediaItems} />
        <PressMediaKitBlock />
      </div>
    </MarketingCatalogHubShell>
  );
}
