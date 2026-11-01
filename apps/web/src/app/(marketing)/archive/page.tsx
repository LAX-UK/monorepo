import { ViewItemListTracker } from "@/components/analytics/view-item-list-tracker";
import { MarketingCatalogHubShell } from "@/components/marketing/marketing-catalog-hub-shell";
import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { ArchivePageToolbar } from "@/components/sections/archive/archive-page-toolbar";
import { ArchivePagination } from "@/components/sections/archive/archive-pagination";
import { CatalogArchiveViewClient } from "@/components/sections/archive/catalog-archive-view-client";
import type { ArchiveLotVM } from "@/components/sections/archive/catalog-archive-views";
import { PastAuctionsEmpty } from "@/components/sections/archive/past-auctions-grid";
import { PastAuctionsHeader } from "@/components/sections/archive/past-auctions-header";
import { archiveTotalVolumeLabel } from "@/lib/archive/archive-total-volume";
import {
  buildArchivePageQuery,
  countActiveArchiveFilters,
} from "@/lib/archive/build-archive-params";
import { SITE_SEO_NAME } from "@/lib/brand";
import { getServerArchiveMetricsReader, getServerLotReader } from "@/lib/catalog/catalog.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getServerPublicUserReader } from "@/lib/data/http/users-public.server";
import { archiveLotLinkParams } from "@/lib/marketing/catalog-links";
import { resolveMarketingLayoutView } from "@/lib/preferences/resolve-marketing-layout-view.server";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { lotPath } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import type { Category, Lot } from "@auction/types";
import { ButtonLink } from "@auction/ui/lax";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = metadataForStatic({
  title: "Past auctions",
  description: `Browse past auctions, realized prices, and archived lots from ${SITE_SEO_NAME}.`,
  path: "/archive",
});

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function filtersFallback() {
  return (
    <div className="mb-8 h-14 animate-pulse rounded-md bg-surface-container-high" aria-hidden />
  );
}

function firstString(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return typeof v === "string" ? v : v[0];
}

export default async function ArchivePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = buildArchivePageQuery(sp);

  let categories: Category[] = [];
  let totalHammer = "0";
  let auctions: Lot[] = [];
  let totalCount = 0;

  try {
    const [catReader, metricsReader, auctionReader, publicReader, session] = await Promise.all([
      getServerCategoryReader(),
      getServerArchiveMetricsReader(),
      getServerLotReader(),
      getServerPublicUserReader(),
      getServerSessionUser(),
    ]);
    const currentUserId = session?.id ?? null;

    const layoutView: CatalogLayoutView = await resolveMarketingLayoutView({
      routeKey: "archive",
      category: "lots",
      urlView: firstString(sp.view),
      user: session,
      fallback: "grid",
    });

    categories = await catReader.listWithPublishedLots();
    const [summary, count, list] = await Promise.all([
      metricsReader.getEndedSummary(q.endYear),
      metricsReader.countEndedLots({
        ...(q.categoryId !== undefined ? { categoryId: q.categoryId } : {}),
        ...(q.endYear !== undefined ? { endYear: q.endYear } : {}),
      }),
      auctionReader.list(q.listParams),
    ]);
    totalHammer = summary.totalHammer;
    totalCount = count;
    auctions = list;

    const sellerIds = [
      ...new Set(
        auctions
          .map((a) => a.sellerId ?? a.sellerLegalEntityId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const nameEntries = await Promise.all(
      sellerIds.map(async (id) => {
        const u = await publicReader.getById(id).catch(() => null);
        return [id, u?.name ?? "Private seller"] as const;
      }),
    );
    const sellerNames = new Map(nameEntries);

    const items: ArchiveLotVM[] = auctions.map((a) => ({
      auction: a,
      sellerName: sellerNames.get(a.sellerId ?? a.sellerLegalEntityId ?? "") ?? "Private seller",
    }));

    const totalPages = Math.max(1, Math.ceil(totalCount / q.pageSize));
    const hasActiveFilters = countActiveArchiveFilters(q) > 0;

    const base = getSiteUrl();
    const crumbs = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Past auctions", path: "/archive" },
    ]);
    const itemsLd =
      auctions.length > 0
        ? itemListJsonLd(auctions.map((a) => ({ name: a.title, url: `${base}${lotPath(a)}` })))
        : null;
    const jsonLdText = jsonLdScript(...(itemsLd ? [crumbs, itemsLd] : [crumbs]));

    return (
      <MarketingCatalogHubShell
        jsonLd={
          <script type="application/ld+json" suppressHydrationWarning>
            {jsonLdText}
          </script>
        }
        hero={<PastAuctionsHeader totalVolumeLabel={archiveTotalVolumeLabel(totalHammer)} />}
        toolbar={
          <Suspense fallback={filtersFallback()}>
            <ArchivePageToolbar
              query={q}
              resultCount={totalCount}
              categories={categories}
              layoutView={layoutView}
            />
          </Suspense>
        }
        footer={
          <Suspense fallback={null}>
            <ArchivePagination page={q.page} totalPages={totalPages} />
          </Suspense>
        }
      >
        <ViewItemListTracker
          listId="archive"
          listName="Past auctions"
          itemIds={items.map((i) => i.auction.id)}
        />
        {items.length === 0 ? (
          <PastAuctionsEmpty hasActiveFilters={hasActiveFilters} layoutView={layoutView} />
        ) : (
          <CatalogArchiveViewClient
            initialView={layoutView}
            items={items}
            currentUserId={currentUserId}
            catalogLinkParams={archiveLotLinkParams(layoutView)}
          />
        )}
      </MarketingCatalogHubShell>
    );
  } catch (err) {
    console.error("[ArchivePage]", err);
    return (
      <MarketingCatalogHubShell
        hero={<PastAuctionsHeader totalVolumeLabel={null} />}
        toolbar={
          <Suspense fallback={filtersFallback()}>
            <ArchivePageToolbar query={q} resultCount={0} categories={[]} layoutView="grid" />
          </Suspense>
        }
      >
        <MarketingEmptyState
          variant="marketing"
          context="error"
          title="Archive temporarily unavailable"
          description="We couldn't load past auction results right now. Please try again in a moment."
          action={
            <>
              <ButtonLink Link={Link} variant="primary" href="/archive">
                Try again
              </ButtonLink>
              <ButtonLink Link={Link} variant="secondary" href="/">
                Back to home
              </ButtonLink>
            </>
          }
        />
      </MarketingCatalogHubShell>
    );
  }
}
