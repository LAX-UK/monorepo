import { CatalogLotView } from "@/components/marketing/catalog-lot-view";
import { CatalogViewSwitcher } from "@/components/marketing/catalog-view-switcher";
import { CopyCatalogLinkButton } from "@/components/marketing/copy-catalog-link-button";
import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { MarketingListToolbar } from "@/components/marketing/marketing-list-toolbar";
import { MarketingPageHero } from "@/components/marketing/marketing-page-hero";
import { SearchActiveFilters } from "@/components/marketing/search-active-filters";
import {
  SearchCatalogPendingProvider,
  SearchResultsShell,
} from "@/components/marketing/search-catalog-client";
import { SearchFilterForm } from "@/components/marketing/search-filter-form";
import { SearchPaginationBar } from "@/components/marketing/search-pagination-bar";
import { SearchSortSelect, type SearchSortValue } from "@/components/marketing/search-sort-select";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerLotReader } from "@/lib/data/http/lots.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getServerWatchedLotIdSet } from "@/lib/data/http/watchlist.server";
import { resolveMarketingLayoutView } from "@/lib/preferences/resolve-marketing-layout-view.server";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { metadataForListing } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { lotPath } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import type { Category, Lot } from "@auction/types";
import { SectionCta } from "@auction/ui";
import { cn } from "@auction/ui";
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

function buildSearchQs(opts: {
  offset: number;
  q: string;
  sort: string;
  categoryId?: string;
  view: CatalogLayoutView;
}): string {
  const p = new URLSearchParams();
  p.set("offset", String(opts.offset));
  if (opts.q.trim()) p.set("q", opts.q.trim());
  if (opts.sort !== "endingAsc") p.set("sort", opts.sort);
  if (opts.categoryId) p.set("categoryId", opts.categoryId);
  p.set("view", opts.view);
  return p.toString();
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
          <SearchActiveFilters categories={categories} sort={sort} />

          <MarketingListToolbar
            {...(countLabel ? { countLabel } : {})}
            filters={
              <div className="flex min-w-0 flex-1 flex-col gap-4">
                <SearchFilterForm
                  initialQ={String(q)}
                  sort={sort}
                  categoryId={categoryId}
                  view={layoutView}
                />
                {categories.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/search?${buildSearchQs({ offset: 0, q: trimmed, sort, view: layoutView })}`}
                      scroll={false}
                      className={cn(
                        "rounded-full border px-3 py-1.5 font-label text-[0.65rem] font-semibold uppercase tracking-wider",
                        !categoryId
                          ? "border-primary bg-primary/10 text-on-surface"
                          : "border-outline-variant/50 text-on-surface-variant hover:border-primary/40",
                      )}
                      aria-current={!categoryId ? "page" : undefined}
                    >
                      All
                    </Link>
                    {categories.map((c) => {
                      const active = categoryId === c.id;
                      return (
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
                          className={cn(
                            "rounded-full border px-3 py-1.5 font-label text-[0.65rem] font-semibold uppercase tracking-wider",
                            active
                              ? "border-primary bg-primary/10 text-on-surface"
                              : "border-outline-variant/50 text-on-surface-variant hover:border-primary/40",
                          )}
                          aria-current={active ? "page" : undefined}
                        >
                          {c.name}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            }
            sort={<SearchSortSelect value={sort} />}
            trailing={
              <>
                <CopyCatalogLinkButton />
                <CatalogViewSwitcher routeKey="search" value={layoutView} />
              </>
            }
          />

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
