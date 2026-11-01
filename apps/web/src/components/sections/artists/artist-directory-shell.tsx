import { CatalogViewSwitcher } from "@/components/marketing/catalog-view-switcher";
import {
  MARKETING_HUB_BREADCRUMB_CLASS,
  MarketingBreadcrumb,
} from "@/components/marketing/marketing-breadcrumb";
import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { MarketingListToolbar } from "@/components/marketing/marketing-list-toolbar";
import { MarketingPromoCta } from "@/components/marketing/marketing-promo-cta";
import { ArtistDirectoryActiveFilters } from "@/components/sections/artists/artist-directory-active-filters";
import { ArtistsDirectoryPagination } from "@/components/sections/artists/artists-directory-pagination";
import { CatalogArtistViewClient } from "@/components/sections/artists/catalog-artist-view-client";
import type { ArtistDirectoryPreset } from "@/lib/artists/directory-presets";
import { artistDirectoryWithQuery } from "@/lib/artists/directory-url";
import { loadArtistDirectoryPage } from "@/lib/artists/load-artist-directory-page";
import { breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { artistPath } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import {
  MarketingAlphabetFilter,
  MarketingDirectory,
  MarketingDirectoryHeader,
  MarketingDirectorySearch,
  type MarketingFilterLinkGroup,
  MarketingFilterLinkGroups,
  MarketingLinkFilterSheet,
  MarketingSortLinks,
} from "@auction/marketing-ui";
import { ButtonLink } from "@auction/ui/lax";
import Link from "next/link";

const SORT_OPTIONS = [
  { value: "name_asc", label: "A–Z" },
  { value: "popular", label: "Most lots" },
  { value: "recent", label: "Recently added" },
] as const;

export type ArtistsDirectoryShellProps = {
  preset: ArtistDirectoryPreset;
  /** Resolved query record (already awaited). */
  searchParams: Record<string, string | string[] | undefined>;
};

/** Letter bucket as a path segment (`/artists/letter/a`), keeping the other filters. */
function letterHref(preservedQuery: string, letter: string | null): string {
  const query = preservedQuery ? `?${preservedQuery}` : "";
  if (letter === null) return `/artists${query}`;
  const segment = letter === "#" ? "0" : letter;
  return `/artists/letter/${segment}${query}`;
}

/** Shared server component that renders the directory for any preset.
 * Each route (`/artists`, `/artists/featured`, `/artists/kind/[kind]`, etc.) is
 * a thin wrapper that resolves a preset and forwards `searchParams` here.
 *
 * - Server-rendered (SSR + cached), so it works without JavaScript and stays crawlable.
 * - The filter rail, the mobile sheet, sort and the A–Z bar are all real links.
 * - An empty result yields a 200 with a "Clear filters" link; callers add `noindex`. */
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

  const preservedQuery = new URLSearchParams(
    Object.fromEntries(Object.entries(carry).filter(([, v]) => v != null) as [string, string][]),
  );
  preservedQuery.delete("offset");

  const sortLinks = SORT_OPTIONS.map((o) => ({
    label: o.label,
    active: sort === o.value,
    href: artistDirectoryWithQuery(preset.canonicalPath, sp, {
      sort: o.value === "name_asc" ? null : o.value,
      offset: null,
      view: layoutView,
    }),
  }));

  const railGroups: MarketingFilterLinkGroup[] = [
    ...filterGroups,
    ...(nationalityLinks && nationalityLinks.length > 0
      ? [{ id: "nationality", title: "Top nationalities", links: nationalityLinks }]
      : []),
  ];

  const breadcrumbItems =
    preset.id === "all"
      ? [
          { label: "Home", href: "/" },
          { label: "Artists", current: true as const },
        ]
      : [
          { label: "Home", href: "/" },
          { label: "Artists", href: "/artists" },
          { label: preset.heroTitle, current: true as const },
        ];

  return (
    <MarketingDirectory
      as="main"
      railLabel="Artist directory filters"
      jsonLd={
        <>
          <link rel="canonical" href={canonicalUrl} />
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
      header={
        <MarketingDirectoryHeader
          breadcrumb={
            <MarketingBreadcrumb
              items={breadcrumbItems}
              className={MARKETING_HUB_BREADCRUMB_CLASS}
            />
          }
          title={preset.heroTitle}
          description={preset.heroDescription}
          search={
            <MarketingDirectorySearch
              action={preset.canonicalPath}
              label="Search artists"
              placeholder="Name or keyword"
              defaultValue={q}
              hidden={{
                sort: sort !== "name_asc" ? sort : undefined,
                view: layoutView,
                nationality:
                  nationalityFromQuery && !nationalityIsLocked ? nationalityFromQuery : undefined,
              }}
            />
          }
          chips={
            <MarketingSortLinks
              label="Browse"
              options={page.presetChips.map((c) => ({
                label: c.label,
                href: c.href,
                active: c.active,
              }))}
            />
          }
          letterBar={
            <MarketingAlphabetFilter
              basePath="/artists"
              active={preset.filter.letter}
              hrefFor={(letter) => letterHref(preservedQuery.toString(), letter)}
              counts={facets.letters}
              includeOtherBuckets
              ariaLabel="Jump to letter"
            />
          }
        />
      }
      rail={
        <MarketingFilterLinkGroups
          groups={railGroups}
          clearHref={preset.canonicalPath}
          hasFilters={hasUserFilters}
          idPrefix="rail"
        />
      }
      toolbar={
        <MarketingListToolbar
          className="rounded-none border-x-0"
          gutter={false}
          countLabel={pagination.countLabel}
          stackTrailingOnMobile
          mobileFilterTrigger={
            <MarketingLinkFilterSheet
              activeCount={activeFilterCount}
              resultLabel={pagination.resultCountLabel}
              resetHref={preset.canonicalPath}
            >
              <MarketingFilterLinkGroups
                groups={[...railGroups, { id: "sort", title: "Sort by", links: sortLinks }]}
                clearHref={preset.canonicalPath}
                hasFilters={hasUserFilters}
                idPrefix="sheet"
              />
            </MarketingLinkFilterSheet>
          }
          sort={<MarketingSortLinks options={sortLinks} className="hidden md:flex" />}
          trailing={<CatalogViewSwitcher routeKey="artists" value={layoutView} />}
        />
      }
      activeFilters={
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
      }
      footer={
        <>
          {total > 0 ? (
            <ArtistsDirectoryPagination
              currentPage={pagination.currentPage}
              totalPages={pagination.totalPages}
              getPageHref={pagination.getPageHref}
            />
          ) : null}
          <div className="mt-10">
            <MarketingPromoCta
              title="Submit your portfolio"
              description="Request a valuation or submit work to be considered for an upcoming auction."
              actions={
                <>
                  <ButtonLink Link={Link} variant="primary" href="/selling/new">
                    Submit work
                  </ButtonLink>
                  <ButtonLink Link={Link} variant="secondary" href="/sell">
                    Selling guide
                  </ButtonLink>
                </>
              }
            />
          </div>
        </>
      }
    >
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
              <ButtonLink Link={Link} variant="primary" href={preset.canonicalPath}>
                Clear filters
              </ButtonLink>
              <ButtonLink Link={Link} variant="secondary" href="/artists">
                Browse all artists
              </ButtonLink>
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
    </MarketingDirectory>
  );
}
