import { CatalogLotView } from "@/components/marketing/catalog-lot-view";
import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { MarketingPageHero } from "@/components/marketing/marketing-page-hero";
import { SearchActiveFilters } from "@/components/marketing/search-active-filters";
import {
  SearchCatalogPendingProvider,
  SearchResultsShell,
} from "@/components/marketing/search-catalog-client";
import { SearchFilterForm } from "@/components/marketing/search-filter-form";
import { SearchPageToolbar } from "@/components/marketing/search-page-toolbar";
import { SearchPaginationBar } from "@/components/marketing/search-pagination-bar";
import type { SearchSortValue } from "@/components/marketing/search-sort-select";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getServerWatchedLotIdSet } from "@/lib/data/http/watchlist.server";
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
    (typeof sp.view === "string" && sp.view.trim().length > 0);
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
  const { q = "", offset: offsetRaw = "0", sort: sortRaw, categoryId: catRaw, view: viewRaw } = sp;
  const offset = Math.max(0, Number.parseInt(String(offsetRaw), 10) || 0);
  const trimmed = String(q).trim();
  const sort = parseSort(firstString(sortRaw));
  const categoryId = firstString(catRaw);

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
  try {
    const fetchLimit = PAGE_SIZE + 1;
    auctions = await reader.list({
      limit: fetchLimit,
      offset,
      ...(trimmed ? { q: trimmed } : {}),
      sort,
      ...(categoryId ? { categoryId } : {}),
    });
  } catch {
    loadError = "We couldn’t load inventory right now. Please try again shortly.";
  }
  const hasNext = auctions.length > PAGE_SIZE;
  const filtered = hasNext ? auctions.slice(0, PAGE_SIZE) : auctions;
  const hasPrev = offset > 0;
  const nextOffset = offset + PAGE_SIZE;
  const prevOffset = Math.max(0, offset - PAGE_SIZE);

  const loginNextPath = `/search?${buildSearchQs({
    offset,
    q: trimmed,
    sort,
    ...(categoryId ? { categoryId } : {}),
    view: layoutView,
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
    });

  const popularCategories = categories.slice(0, 6);
  const countLabel = loadError ? undefined : `${filtered.length}${hasNext ? "+" : ""} lots`;
  const activeFilterCount = countSearchActiveFilters({
    q: trimmed,
    ...(categoryId ? { categoryId } : {}),
    sort,
  });
  const resultCountLabel =
    filtered.length === 0
      ? "Show results"
      : hasNext
        ? `Show ${filtered.length}+ results`
        : `Show ${filtered.length} results`;

  return (
    <SearchCatalogPendingProvider>
      <main id="main-content" className="bg-surface pb-24">
        <script type="application/ld+json" suppressHydrationWarning>
          {listLdText}
        </script>

        <MarketingPageHero
          title="Search lots"
          titleSize="section"
          description="Browse live inventory by title, medium, and category. Save lots to your watchlist to track them from your dashboard."
          meta={
            !loadError ? (
              <p className="font-label text-xs font-semibold uppercase tracking-widest text-primary">
                {resultSummaryLabel(trimmed, filtered.length, hasNext)}
              </p>
            ) : null
          }
        />

        <div className="mx-auto max-w-[var(--container-max,1440px)] px-6 md:px-16">
          <div className="mb-6 hidden md:block">
            <SearchFilterForm
              variant="hero"
              initialQ={String(q)}
              sort={sort}
              categoryId={categoryId}
              view={layoutView}
            />
          </div>

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
          />

          <SearchActiveFilters categories={categories} sort={sort} />

          <SearchResultsShell>
            {loadError ? (
              <MarketingEmptyState
                className="mt-8 rounded-xl border border-error/30 bg-error-container/10"
                role="alert"
                title="Could not load inventory"
                description={loadError}
              />
            ) : filtered.length === 0 ? (
              <MarketingEmptyState
                className="mt-8"
                title={trimmed ? "No lots match that search" : "No lots to show yet"}
                description="Try another search, pick a category below, or browse upcoming and past sales."
                action={
                  <div className="flex w-full max-w-lg flex-col items-center gap-6">
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
                              })}`}
                              scroll={false}
                              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-full border border-outline-variant/60 px-4 py-2 font-label text-xs font-semibold uppercase tracking-widest text-on-surface-variant transition-colors hover:border-primary/50 hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
                <div className="mt-8">
                  <CatalogLotView
                    view={layoutView}
                    lots={filtered}
                    currentUserId={currentUserId}
                    isAuthenticated={isAuthenticated}
                    watchedLotIds={watchedLotIds}
                    loginNextPath={loginNextPath}
                  />
                </div>
                <SearchPaginationBar
                  offset={offset}
                  resultCount={filtered.length}
                  hasNext={hasNext}
                  hasPrev={hasPrev}
                  prevHref={`/search?${qsBaseOffset(prevOffset)}`}
                  nextHref={`/search?${qsBaseOffset(nextOffset)}`}
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
        </div>
      </main>
    </SearchCatalogPendingProvider>
  );
}
