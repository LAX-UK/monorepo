import { CatalogViewSwitcher } from "@/components/marketing/catalog-view-switcher";
import { MarketingCatalogHubShell } from "@/components/marketing/marketing-catalog-hub-shell";
import { MarketingChipStrip } from "@/components/marketing/marketing-chip-strip";
import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { MarketingFilterSidebar } from "@/components/marketing/marketing-filter-sidebar";
import { MarketingListToolbar } from "@/components/marketing/marketing-list-toolbar";
import { MarketingPromoCta } from "@/components/marketing/marketing-promo-cta";
import { ArtistDirectoryActiveFilters } from "@/components/sections/artists/artist-directory-active-filters";
import { ArtistDirectoryFilters } from "@/components/sections/artists/artist-directory-filters";
import { ArtistFiltersSheet } from "@/components/sections/artists/artist-filters-sheet";
import { ArtistsDirectoryHero } from "@/components/sections/artists/artists-directory-hero";
import { ArtistsDirectoryPagination } from "@/components/sections/artists/artists-directory-pagination";
import { CatalogArtistViewClient } from "@/components/sections/artists/catalog-artist-view-client";
import type { ArtistDirectoryPreset } from "@/lib/artists/directory-presets";
import { artistDirectoryWithQuery } from "@/lib/artists/directory-url";
import { loadArtistDirectoryPage } from "@/lib/artists/load-artist-directory-page";
import {
  MARKETING_CATALOG_FILTER_GRID,
  MARKETING_CATALOG_FILTER_RAIL_SLOT,
  MARKETING_CATALOG_MAIN_COLUMN,
} from "@/lib/marketing/chrome";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { MARKETING_FILTER_RAIL_STICKY } from "@/lib/marketing/filter-rail";
import { breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { artistPath } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import { AlphabetJumpBar, cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

const SORT_OPTIONS = [
  { value: "name_asc", label: "A–Z" },
  { value: "popular", label: "Most lots" },
  { value: "recent", label: "Recently added" },
] as const;
type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export type ArtistsDirectoryShellProps = {
  preset: ArtistDirectoryPreset;
  /** Resolved query record (already awaited). */
  searchParams: Record<string, string | string[] | undefined>;
};

/** Shared server component that renders the directory for any preset.
 * Each route (`/artists`, `/artists/featured`, `/artists/kind/[kind]`, etc.) is
 * a thin wrapper that resolves a preset and forwards `searchParams` here.
 *
 * Behavior:
 * - Server-rendered (SSR + cached) — preserves SEO + works without JS.
 * - Side filter rail uses real anchors, including facet counts from the API.
 * - Sort/page navigate via query strings; the active preset path stays intact.
 * - Empty result yields a 200 with a "Clear filters" link; the page stays
 *   `noindex` for soft-404 avoidance (callers add the meta in `generateMetadata`). */
export async function ArtistsDirectoryShell({ preset, searchParams }: ArtistsDirectoryShellProps) {
  const sp = searchParams;
  const page = await loadArtistDirectoryPage(preset, sp);
  const { params, layoutView, isAuthenticated, watchSet, browse, carry } = page;
  const { rows, total, facets } = browse;
  const { filterGroups, nationalityLinks, hasUserFilters, activeFilterCount, pagination } = page;
  const {
    q,
    sort,
    nationalityFromQuery,
    nationalityIsLocked,
    decadeFromQuery,
    decadeIsLocked,
    hasUpcoming,
  } = params;

  const baseUrl = getSiteUrl();
  const canonicalUrl = `${baseUrl}${preset.canonicalPath}`;
  const crumbsLd = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Artists", path: "/artists" },
    ...(preset.canonicalPath === "/artists"
      ? []
      : [{ name: preset.heroTitle, path: preset.canonicalPath }]),
  ]);
  const itemsLd = itemListJsonLd(
    rows.map((a) => ({
      name: a.displayName,
      url: `${baseUrl}${artistPath({ id: a.id, name: a.displayName })}`,
    })),
  );

  const letterBar = (
    <AlphabetJumpBar
      basePath="/artists"
      preservedQuery={new URLSearchParams(
        Object.fromEntries(
          Object.entries(carry).filter(([, v]) => v != null) as [string, string][],
        ),
      ).toString()}
      active={preset.filter.letter}
      letterCounts={facets.letters}
      pathSegments
    />
  );

  return (
    <MarketingCatalogHubShell
      className="overflow-x-clip"
      jsonLd={
        <>
          <script type="application/ld+json" suppressHydrationWarning>
            {jsonLdScript(crumbsLd)}
          </script>
          {rows.length > 0 ? (
            <script type="application/ld+json" suppressHydrationWarning>
              {jsonLdScript(itemsLd)}
            </script>
          ) : null}
        </>
      }
      hero={
        <ArtistsDirectoryHero
          preset={preset}
          layoutView={layoutView}
          sort={sort}
          {...(q ? { q } : {})}
          {...(nationalityFromQuery && !nationalityIsLocked ? { nationalityFromQuery } : {})}
          nationalityIsLocked={nationalityIsLocked}
          segChips={page.presetChips}
          letterBar={letterBar}
        />
      }
    >
      <section className="py-8 sm:py-12 md:py-12">
        <link rel="canonical" href={canonicalUrl} />

        <div className={MARKETING_CATALOG_FILTER_GRID}>
          <div className={MARKETING_CATALOG_FILTER_RAIL_SLOT}>
            <MarketingFilterSidebar
              aria-label="Artist directory filters"
              className={MARKETING_FILTER_RAIL_STICKY}
            >
              <ArtistDirectoryFilters
                groups={filterGroups}
                {...(nationalityLinks !== undefined ? { nationalityLinks } : {})}
                clearHref={preset.canonicalPath}
                hasFilters={hasUserFilters}
              />
            </MarketingFilterSidebar>
          </div>

          <div className={MARKETING_CATALOG_MAIN_COLUMN}>
            <MarketingListToolbar
              className="mb-6 rounded-none border-x-0"
              countLabel={pagination.countLabel}
              mobileFilterTrigger={
                <ArtistFiltersSheet
                  activeCount={activeFilterCount}
                  canonicalPath={preset.canonicalPath}
                  sort={sort}
                  groups={filterGroups}
                  {...(nationalityLinks !== undefined ? { nationalityLinks } : {})}
                  clearHref={preset.canonicalPath}
                  hasFilters={hasUserFilters}
                  resultCountLabel={pagination.resultCountLabel}
                />
              }
              sort={
                <div className="hidden md:block">
                  <MarketingChipStrip aria-label="Sort artists">
                    <span
                      aria-hidden
                      className="mr-1 shrink-0 snap-start font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant"
                    >
                      Sort
                    </span>
                    {SORT_OPTIONS.map((o) => {
                      const active = (sort as SortValue) === o.value;
                      const href = artistDirectoryWithQuery(preset.canonicalPath, sp, {
                        sort: o.value === "name_asc" ? null : o.value,
                        offset: null,
                        view: layoutView,
                      });
                      return (
                        <Link
                          key={o.value}
                          href={href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "inline-flex min-h-11 shrink-0 snap-start items-center rounded-full px-3 py-1.5 font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] ring-1 transition-colors",
                            FOCUS_RING,
                            active
                              ? "bg-primary text-on-primary ring-primary"
                              : "bg-surface-container-low text-on-surface-variant ring-outline-variant/20 hover:bg-surface-container-high/80 hover:text-on-surface",
                          )}
                        >
                          {o.label}
                        </Link>
                      );
                    })}
                  </MarketingChipStrip>
                </div>
              }
              trailing={<CatalogViewSwitcher routeKey="artists" value={layoutView} />}
            />

            <ArtistDirectoryActiveFilters
              state={{
                canonicalPath: preset.canonicalPath,
                searchParams: sp,
                layoutView,
                ...(q ? { q } : {}),
                ...(nationalityFromQuery && !nationalityIsLocked ? { nationalityFromQuery } : {}),
                nationalityIsLocked,
                ...(decadeFromQuery && !decadeIsLocked ? { decadeFromQuery } : {}),
                decadeIsLocked,
                hasUpcoming,
                sort,
              }}
            />

            {rows.length === 0 ? (
              <MarketingEmptyState
                variant="marketing"
                className="rounded-2xl"
                title="No artists match these filters."
                description={
                  <p className="font-body text-sm text-on-surface-variant">
                    Try a broader scenario or clear your filters.
                  </p>
                }
                action={
                  <>
                    <Button asChild>
                      <Link href={preset.canonicalPath}>Clear filters</Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/artists">Browse all artists</Link>
                    </Button>
                  </>
                }
              />
            ) : (
              <CatalogArtistViewClient
                initialView={layoutView}
                rows={rows}
                watchSet={watchSet}
                isAuthenticated={isAuthenticated}
                profileLinkContext={{
                  fromPath: preset.canonicalPath,
                  searchParams: sp,
                  layoutView,
                }}
              />
            )}

            {total > 0 ? (
              <ArtistsDirectoryPagination
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                getPageHref={pagination.getPageHref}
              />
            ) : null}

            <div className="mt-16">
              <MarketingPromoCta
                title="Submit your portfolio"
                description="Request a valuation or submit work to be considered for an upcoming auction."
                actions={
                  <>
                    <Button variant="cta" asChild>
                      <Link href="/dashboard/submissions/new">Submit work</Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href="/sell">Selling guide</Link>
                    </Button>
                  </>
                }
              />
            </div>
          </div>
        </div>
      </section>
    </MarketingCatalogHubShell>
  );
}
