import { ViewItemListTracker } from "@/components/analytics/view-item-list-tracker";
import { CatalogLotViewClient } from "@/components/marketing/catalog-lot-view-client";
import { MarketingBidPromoCta } from "@/components/marketing/marketing-bid-promo-cta";
import {
  MARKETING_HUB_BREADCRUMB_CLASS,
  MarketingBreadcrumb,
} from "@/components/marketing/marketing-breadcrumb";
import { MarketingCatalogHubShell } from "@/components/marketing/marketing-catalog-hub-shell";
import { MarketingPageHero } from "@/components/marketing/marketing-page-hero";
import { RecentlyViewedRail } from "@/components/marketing/recently-viewed-rail";
import {
  SearchCatalogPendingProvider,
  SearchResultsShell,
} from "@/components/marketing/search-catalog-client";
import { SearchNoMatches } from "@/components/marketing/search-fallback";
import { SearchFilterFormDesktop } from "@/components/marketing/search-filter-form";
import { SearchPageToolbar } from "@/components/marketing/search-page-toolbar";
import { SearchPaginationBar } from "@/components/marketing/search-pagination-bar";
import type { SearchSortValue } from "@/components/marketing/search-sort-select";
import { SITE_SEO_NAME } from "@/lib/brand";
import { getServerLotCount, getServerLotReader } from "@/lib/catalog/catalog.server";
import { getServerAccountAlerts } from "@/lib/data/http/alerts.server";
import { getServerMyArtistWatchIds } from "@/lib/data/http/artist-watchlist.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerMySavedSearches } from "@/lib/data/http/saved-searches.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getServerWatchedLotIdSet } from "@/lib/data/http/watchlist.server";
import { toCatalogLotVMs } from "@/lib/lot/to-catalog-lot-vm";
import { catalogViewCarryParams } from "@/lib/marketing/catalog-links";
import { loadSearchFallback } from "@/lib/marketing/load-search-fallback";
import {
  parseSearchEnding,
  parseSearchStatus,
  searchEndingLabel,
  searchStatusLabel,
} from "@/lib/marketing/parse-search-params";
import { countSearchActiveFilters } from "@/lib/marketing/search-active-filter-count";
import { findSearchAlert, searchAlertState } from "@/lib/marketing/search-fallback";
import { shouldOfferPastResults } from "@/lib/marketing/search-fallback";
import { buildSearchQs } from "@/lib/marketing/search-qs";
import { alertAccessOf, searchTopicEmailOn } from "@/lib/notifications/engine-alert-state";
import { resolveMarketingLayoutView } from "@/lib/preferences/resolve-marketing-layout-view.server";
import { metadataForListing } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { lotPath } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import { buildLotMediaTreatmentIndex } from "@auction/domain";
import type { Lot } from "@auction/types";
import { ButtonLink } from "@auction/ui/lax/button-link";
import { EmptyState } from "@auction/ui/lax/empty-state";
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
    alert?: string;
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
    description: `Search curated fine art lots by title \u2014 browse live inventory from ${SITE_SEO_NAME}.`,
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
    alert: alertRaw,
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
  const categories = catReader ? await catReader.listWithPublishedLots().catch(() => []) : [];
  const treatments = buildLotMediaTreatmentIndex(categories);

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
      const [list, count] = await Promise.all([
        reader.list({
          limit: fetchLimit,
          offset,
          ...(trimmed ? { q: trimmed } : {}),
          sort: "endingAsc",
          status: "active",
          endingWithinHours: 24,
          ...(categoryId ? { categoryId } : {}),
        }),
        getServerLotCount({
          ...(trimmed ? { q: trimmed } : {}),
          ...(categoryId ? { categoryId } : {}),
          status: "active",
          endingWithinHours: 24,
        }),
      ]);
      exactTotal = count;
      hasNext = list.length > PAGE_SIZE;
      auctions = hasNext ? list.slice(0, PAGE_SIZE) : list;
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
  } catch (error) {
    console.error("[search] inventory load failed", error);
    loadError = "We couldn’t load inventory right now. Please try again shortly.";
  }
  const filtered = auctions;
  const offerPastResults = shouldOfferPastResults({
    q: trimmed,
    status: statusFilter,
    ending: endingWindow,
    offset,
    onSaleCount: filtered.length,
    loadFailed: loadError !== null,
  });
  const [fallback, watchedArtistIds, savedSearches, accountAlerts] = offerPastResults
    ? await Promise.all([
        loadSearchFallback(trimmed, categoryId),
        isAuthenticated ? getServerMyArtistWatchIds() : Promise.resolve([] as string[]),
        isAuthenticated ? getServerMySavedSearches() : Promise.resolve(null),
        isAuthenticated ? getServerAccountAlerts() : Promise.resolve(null),
      ])
    : [null, [] as string[], null, null];
  // A failed read falls back to the plain button; saving still avoids a duplicate.
  const topicEmailOn = searchTopicEmailOn(accountAlerts, session?.emailVerified);
  const alertSearch = savedSearches
    ? findSearchAlert(savedSearches, trimmed, categoryId)
    : undefined;
  const alertSearchId = alertSearch?.id ?? null;
  const emailAccess = alertAccessOf(accountAlerts, session?.emailVerified);
  const otherSearchesOn = (savedSearches ?? []).filter(
    (row) => row.notifyEmail && row.id !== alertSearchId,
  ).length;
  const alertState = savedSearches
    ? searchAlertState(savedSearches, trimmed, categoryId, topicEmailOn)
    : "none";
  const catalogLots = toCatalogLotVMs(filtered);
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

  const pastResultsHref = `/search?${buildSearchQs({
    offset: 0,
    q: trimmed,
    sort: "hammerDesc",
    ...(categoryId ? { categoryId } : {}),
    view: layoutView,
    status: "ended",
  })}`;
  const alertReturnHref = `${loginNextPath}&alert=1`;

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
            description="Browse live inventory by title, medium, and category. Save lots to your watch list to follow them in Watching."
            meta={
              !loadError ? (
                <p className="font-label text-xs font-medium text-on-surface-variant">
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
        {filtered.length > 0 ? <RecentlyViewedRail className="px-0" /> : null}

        <SearchResultsShell>
          {loadError ? (
            <div className="mt-8 rounded-lax-card border border-lax-line bg-lax-surface">
              <EmptyState
                illustration="askew"
                variant="error"
                headingLevel="h2"
                title="Could not load inventory"
                description={loadError}
                actions={
                  <>
                    <ButtonLink Link={Link} variant="primary" href="/search">
                      Try again
                    </ButtonLink>
                    <ButtonLink Link={Link} variant="secondary" href="/sales">
                      Browse sales
                    </ButtonLink>
                  </>
                }
              />
            </div>
          ) : fallback ? (
            <SearchNoMatches
              q={trimmed}
              {...(categoryId ? { categoryId } : {})}
              fallback={fallback}
              layoutView={layoutView}
              isAuthenticated={isAuthenticated}
              currentUserId={currentUserId}
              watchedLotIds={watchedLotIds}
              treatments={treatments}
              watchedArtistIds={new Set(watchedArtistIds)}
              clearHref={clearFiltersHref}
              pastResultsHref={pastResultsHref}
              alertReturnHref={alertReturnHref}
              saveAlertOnArrival={firstString(alertRaw) === "1"}
              alertState={alertState}
              topicEmailOn={topicEmailOn}
              alertSearchId={alertSearchId}
              alertSearchNotifyEmail={alertSearch?.notifyEmail ?? false}
              emailAccess={emailAccess}
              otherSearchesOn={otherSearchesOn}
              {...(lotCatalogLinkParams ? { catalogLinkParams: lotCatalogLinkParams } : {})}
            />
          ) : filtered.length === 0 ? (
            <div className="mt-8 rounded-lax-card border border-lax-line bg-lax-surface">
              <EmptyState
                illustration="search"
                headingLevel="h2"
                title={
                  hasActiveFilters || trimmed
                    ? "No lots match these filters"
                    : "Nothing to show yet"
                }
                description={
                  hasActiveFilters || trimmed
                    ? "Try fewer filters or a different spelling."
                    : "Search by artist, title or sale."
                }
                {...(hasActiveFilters
                  ? {
                      actions: (
                        <>
                          <ButtonLink Link={Link} variant="primary" href={clearFiltersHref}>
                            Clear filters
                          </ButtonLink>
                          <ButtonLink Link={Link} variant="secondary" href="/search">
                            Search all lots
                          </ButtonLink>
                        </>
                      ),
                    }
                  : {})}
              />
            </div>
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
                  lots={catalogLots}
                  currentUserId={currentUserId}
                  isAuthenticated={isAuthenticated}
                  watchedLotIds={watchedLotIds}
                  loginNextPath={loginNextPath}
                  treatments={treatments}
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
              {!session ? <MarketingBidPromoCta className="mt-16" /> : null}
            </>
          )}
        </SearchResultsShell>
      </MarketingCatalogHubShell>
    </SearchCatalogPendingProvider>
  );
}
