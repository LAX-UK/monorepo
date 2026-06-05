import { ViewItemListTracker } from "@/components/analytics/view-item-list-tracker";
import { CatalogLotViewClient } from "@/components/marketing/catalog-lot-view-client";
import {
  MARKETING_HUB_BREADCRUMB_CLASS,
  MarketingBreadcrumb,
} from "@/components/marketing/marketing-breadcrumb";
import { MarketingCatalogHubShell } from "@/components/marketing/marketing-catalog-hub-shell";
import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { MarketingPageHero } from "@/components/marketing/marketing-page-hero";
import { RecentlyViewedRail } from "@/components/marketing/recently-viewed-rail";
import {
  SearchCatalogPendingProvider,
  SearchResultsShell,
} from "@/components/marketing/search-catalog-client";
import { SearchFilterFormDesktop } from "@/components/marketing/search-filter-form";
import { SearchPageToolbar } from "@/components/marketing/search-page-toolbar";
import { SearchPaginationBar } from "@/components/marketing/search-pagination-bar";
import type { SearchSortValue } from "@/components/marketing/search-sort-select";
import { lotsEndingSoon } from "@/components/sections/home/home-urgency-helpers";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerLotCount, getServerLotReader } from "@/lib/data/http/lots.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getServerWatchedLotIdSet } from "@/lib/data/http/watchlist.server";
import { catalogViewCarryParams } from "@/lib/marketing/catalog-links";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import {
  parseSearchEnding,
  parseSearchStatus,
  searchEndingLabel,
  searchStatusLabel,
} from "@/lib/marketing/parse-search-params";
import { countSearchActiveFilters } from "@/lib/marketing/search-active-filter-count";
import { buildSearchQs } from "@/lib/marketing/search-qs";
import { resolveMarketingLayoutView } from "@/lib/preferences/resolve-marketing-layout-view.server";
import { metadataForListing } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { lotPath } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import type { Category, Lot } from "@auction/types";
import { SectionCta } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";

const PAGE_SIZE = 24;

type PageProps = {
  searchParams: Promise<{
    q?: string;
    offset?: string;
    sort?: string;
    categoryId?: string;
    view?: string;
    status?: string;
    ending?: string;
  }>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = await searchParams;
  const hasQuery = typeof sp.q === "string" && sp.q.trim().length > 0;
  const hasFilteredState =
    hasQuery ||
    (typeof sp.categoryId === "string" && sp.categoryId.trim().length > 0) ||
    (typeof sp.sort === "string" && sp.sort.trim().length > 0) ||
    (typeof sp.offset === "string" && sp.offset !== "0") ||
    (typeof sp.view === "string" && sp.view.trim().length > 0) ||
    (typeof sp.status === "string" && sp.status.trim().length > 0) ||
    (typeof sp.ending === "string" && sp.ending.trim().length > 0);
  return metadataForListing({
    title: "Search lots",
    description:
      "Search curated fine art lots by title \u2014 browse live inventory from LAX.BID by London Art Exchange.",
    path: "/search",
    noIndex: hasFilteredState,
  });
}

function firstString(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return typeof v === "string" ? v : v[0];
}

function parseSort(v: string | undefined): SearchSortValue {
  if (v === "createdDesc" || v === "hammerDesc" || v === "endingAsc") return v;
  return "endingAsc";
}

function resultSummaryLabel(trimmed: string, count: number, hasNext: boolean): string {
  const suffix = hasNext ? "+" : "";
  if (trimmed) return `${count}${suffix} lots matching “${trimmed}”`;
  return `${count}${suffix} lots`;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const {
    q = "",
    offset: offsetRaw = "0",
    sort: sortRaw,
    categoryId: catRaw,
    view: viewRaw,
    status: statusRaw,
    ending: endingRaw,
  } = sp;
  const offset = Math.max(0, Number.parseInt(String(offsetRaw), 10) || 0);
  const trimmed = String(q).trim();
  const sort = parseSort(firstString(sortRaw));
  const categoryId = firstString(catRaw);
  const statusFilter = parseSearchStatus(firstString(statusRaw));
  const endingWindow = parseSearchEnding(firstString(endingRaw));

  const [reader, session, catReader, watchedSet] = await Promise.all([
    getServerLotReader(),
    getServerSessionUser(),
    getServerCategoryReader().catch(() => null),
    getServerWatchedLotIdSet(),
  ]);
  const categories = catReader ? await catReader.list().catch(() => []) : [];

  const layoutView = await resolveMarketingLayoutView({
    routeKey: "search",
    category: "lots",
    urlView: firstString(viewRaw),
    user: session,
    fallback: "grid",
  });

  const currentUserId = session?.id ?? null;
  const isAuthenticated = Boolean(session);
  const watchedLotIds = Array.from(watchedSet);

  let auctions: Lot[] = [];
  let loadError: string | null = null;
  let hasNext = false;
  /** Exact total of matching lots; null when unknown (falls back to approximate "N+"). */
  let exactTotal: number | null = null;
  try {
    const fetchLimit = PAGE_SIZE + 1;
    const listSort = endingWindow ? "endingAsc" : sort;
    const listStatus = statusFilter ?? (endingWindow ? "active" : undefined);

    if (endingWindow === "24h") {
      const batch = await reader.list({
        limit: 200,
        offset: 0,
        ...(trimmed ? { q: trimmed } : {}),
        sort: "endingAsc",
        status: "active",
        ...(categoryId ? { categoryId } : {}),
      });
      const endingSoon = lotsEndingSoon(batch);
      exactTotal = endingSoon.length;
      const slice = endingSoon.slice(offset, offset + PAGE_SIZE + 1);
      hasNext = slice.length > PAGE_SIZE;
      auctions = hasNext ? slice.slice(0, PAGE_SIZE) : slice;
    } else {
      const [list, count] = await Promise.all([
        reader.list({
          limit: fetchLimit,
          offset,
          ...(trimmed ? { q: trimmed } : {}),
          sort: listSort,
          ...(listStatus ? { status: listStatus } : {}),
          ...(categoryId ? { categoryId } : {}),
        }),
        getServerLotCount({
          ...(trimmed ? { q: trimmed } : {}),
          ...(categoryId ? { categoryId } : {}),
          ...(listStatus ? { status: listStatus } : {}),
        }),
      ]);
      auctions = list;
      exactTotal = count;
      hasNext = auctions.length > PAGE_SIZE;
      if (hasNext) auctions = auctions.slice(0, PAGE_SIZE);
    }
  } catch {
    loadError = "We couldn’t load inventory right now. Please try again shortly.";
  }
  const filtered = auctions;
  const hasPrev = offset > 0;
  const nextOffset = offset + PAGE_SIZE;
  const prevOffset = Math.max(0, offset - PAGE_SIZE);

  const qsExtras = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(endingWindow ? { ending: endingWindow } : {}),
  };

  const loginNextPath = `/search?${buildSearchQs({
    offset,
    q: trimmed,
    sort,
    ...(categoryId ? { categoryId } : {}),
    view: layoutView,
    ...qsExtras,
  })}`;

  const base = getSiteUrl();
  const listLd =
    filtered.length > 0
      ? itemListJsonLd(
          filtered.map((a) => ({
            name: a.title,
            url: `${base}${lotPath(a)}`,
          })),
        )
      : null;
  const crumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Search", path: "/search" },
  ]);
  const listLdText = listLd ? jsonLdScript(crumbs, listLd) : jsonLdScript(crumbs);

  const qsBaseOffset = (off: number) =>
    buildSearchQs({
      offset: off,
      q: trimmed,
      sort,
      ...(categoryId ? { categoryId } : {}),
      view: layoutView,
      ...qsExtras,
    });

  const popularCategories = categories.slice(0, 6);
  const countLabel = loadError
    ? undefined
    : exactTotal != null
      ? `${exactTotal} ${exactTotal === 1 ? "lot" : "lots"}`
      : `${filtered.length}${hasNext ? "+" : ""} lots`;
  const activeFilterCount = countSearchActiveFilters({
    q: trimmed,
    ...(categoryId ? { categoryId } : {}),
    sort,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(endingWindow ? { ending: endingWindow } : {}),
  });
  const resultCountLabel =
    filtered.length === 0
      ? "Show results"
      : hasNext
        ? `Show ${filtered.length}+ results`
        : `Show ${filtered.length} results`;
  const lotCatalogLinkParams = catalogViewCarryParams(layoutView);
  const hasActiveFilters = activeFilterCount > 0;
  const clearFiltersHref = `/search?${buildSearchQs({
    offset: 0,
    q: "",
    sort: "endingAsc",
    view: layoutView,
  })}`;

  return (
    <SearchCatalogPendingProvider>
      <MarketingCatalogHubShell
        jsonLd={
          <script type="application/ld+json" suppressHydrationWarning>
            {listLdText}
          </script>
        }
        hero={
          <MarketingPageHero
            breadcrumb={
              <MarketingBreadcrumb
                items={[
                  { label: "Home", href: "/" },
                  { label: "Search", current: true },
                ]}
                className={MARKETING_HUB_BREADCRUMB_CLASS}
              />
            }
            title="Search lots"
            titleSize="section"
            className="pb-6 pt-0 md:pb-8"
            description="Browse live inventory by title, medium, and category. Save lots to your watchlist to track them from your dashboard."
            meta={
              !loadError ? (
                <p className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary">
                  {endingWindow
                    ? searchEndingLabel(endingWindow)
                    : statusFilter
                      ? searchStatusLabel(statusFilter)
                      : exactTotal != null
                        ? trimmed
                          ? `${exactTotal} lots matching “${trimmed}”`
                          : `${exactTotal} ${exactTotal === 1 ? "lot" : "lots"}`
                        : resultSummaryLabel(trimmed, filtered.length, hasNext)}
                </p>
              ) : null
            }
          />
        }
        toolbar={
          <>
            <SearchFilterFormDesktop
              initialQ={String(q)}
              sort={sort}
              categoryId={categoryId}
              view={layoutView}
              {...(statusFilter ? { status: statusFilter } : {})}
              {...(endingWindow ? { ending: endingWindow } : {})}
            />
            <SearchPageToolbar
              {...(countLabel ? { countLabel } : {})}
              activeCount={activeFilterCount}
              initialQ={String(q)}
              sort={sort}
              categoryId={categoryId}
              layoutView={layoutView}
              categories={categories}
              trimmed={trimmed}
              resultCountLabel={resultCountLabel}
              {...(statusFilter ? { status: statusFilter } : {})}
              {...(endingWindow ? { ending: endingWindow } : {})}
            />
          </>
        }
      >
        <RecentlyViewedRail className="px-0" />

        <SearchResultsShell>
          {loadError ? (
            <MarketingEmptyState
              variant="marketing"
              context="error"
              className="mt-8 rounded-xl border-error/30 bg-error-container/10"
              title="Could not load inventory"
              description={loadError}
              action={
                <div className="flex flex-wrap justify-center gap-3">
                  <Button variant="cta" asChild>
                    <Link href="/search">Try again</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/sales">Browse sales</Link>
                  </Button>
                </div>
              }
            />
          ) : filtered.length === 0 ? (
            <MarketingEmptyState
              variant="marketing"
              context={hasActiveFilters ? "filtered" : "noResults"}
              className="mt-8"
              title={trimmed ? "No lots match that search" : "No lots to show yet"}
              description="Try another search, pick a category below, or browse upcoming and past sales."
              action={
                <div className="flex w-full max-w-lg flex-col items-center gap-6">
                  {hasActiveFilters ? (
                    <Button variant="cta" asChild>
                      <Link href={clearFiltersHref}>Clear filters</Link>
                    </Button>
                  ) : null}
                  {popularCategories.length > 0 ? (
                    <div className="w-full">
                      <p className="mb-3 font-label text-[0.65rem] font-semibold uppercase tracking-wider text-on-surface-variant">
                        Popular categories
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {popularCategories.map((c: Category) => (
                          <Link
                            key={c.id}
                            href={`/search?${buildSearchQs({
                              offset: 0,
                              q: trimmed,
                              sort,
                              categoryId: c.id,
                              view: layoutView,
                              ...qsExtras,
                            })}`}
                            scroll={false}
                            className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-outline-variant/60 px-4 py-2 font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant transition-colors hover:border-primary/50 hover:text-on-surface ${FOCUS_RING}`}
                          >
                            {c.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap justify-center gap-4">
                    <Button variant="outline" asChild>
                      <Link href="/archive">Past auctions</Link>
                    </Button>
                    <Button variant="cta" asChild>
                      <Link href="/">Upcoming auctions</Link>
                    </Button>
                  </div>
                </div>
              }
            />
          ) : (
            <>
              <ViewItemListTracker
                listId="search"
                listName="Search results"
                itemIds={filtered.map((a) => a.id)}
              />
              <div className="mt-8">
                <CatalogLotViewClient
                  initialView={layoutView}
                  lots={filtered}
                  currentUserId={currentUserId}
                  isAuthenticated={isAuthenticated}
                  watchedLotIds={watchedLotIds}
                  loginNextPath={loginNextPath}
                  {...(lotCatalogLinkParams ? { catalogLinkParams: lotCatalogLinkParams } : {})}
                />
              </div>
              <SearchPaginationBar
                offset={offset}
                pageSize={PAGE_SIZE}
                resultCount={filtered.length}
                hasNext={hasNext}
                hasPrev={hasPrev}
                prevHref={`/search?${qsBaseOffset(prevOffset)}`}
                nextHref={`/search?${qsBaseOffset(nextOffset)}`}
                totalCount={exactTotal}
                getPageHref={(page) => `/search?${qsBaseOffset((page - 1) * PAGE_SIZE)}`}
              />
              {!session ? (
                <SectionCta
                  className="mt-16"
                  title="Ready to bid?"
                  description="Create a free account to place bids and track lots you care about."
                  primary={
                    <Button variant="cta" asChild>
                      <Link href="/register">Register to bid</Link>
                    </Button>
                  }
                  secondary={
                    <Button variant="outline" asChild>
                      <Link href="/login">Sign in</Link>
                    </Button>
                  }
                />
              ) : null}
            </>
          )}
        </SearchResultsShell>
      </MarketingCatalogHubShell>
    </SearchCatalogPendingProvider>
  );
}
