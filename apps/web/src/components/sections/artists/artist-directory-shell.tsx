import { CatalogViewSwitcher } from "@/components/marketing/catalog-view-switcher";
import { CopyCatalogLinkButton } from "@/components/marketing/copy-catalog-link-button";
import { MarketingEmptyState } from "@/components/marketing/marketing-empty-state";
import { MarketingFilterSidebar } from "@/components/marketing/marketing-filter-sidebar";
import { MarketingListToolbar } from "@/components/marketing/marketing-list-toolbar";
import { MarketingPromoCta } from "@/components/marketing/marketing-promo-cta";
import { ArtistDirectoryFilters } from "@/components/sections/artists/artist-directory-filters";
import { ArtistsDirectoryHero } from "@/components/sections/artists/artists-directory-hero";
import { ArtistsDirectoryPagination } from "@/components/sections/artists/artists-directory-pagination";
import { CatalogArtistView } from "@/components/sections/artists/catalog-artist-view";
import { firstString } from "@/lib/admin/admin-list-params";
import {
  ARTIST_DIRECTORY_PRESETS,
  type ArtistDirectoryPreset,
  type ArtistDirectoryPresetId,
  slugifyNationality,
} from "@/lib/artists/directory-presets";
import { artistDirectoryWithQuery, parseArtistDirectoryOffset } from "@/lib/artists/directory-url";
import { getServerMyArtistWatchIds } from "@/lib/data/http/artist-watchlist.server";
import { fetchPublicArtistBrowse } from "@/lib/data/http/artist.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { resolveMarketingLayoutView } from "@/lib/preferences/resolve-marketing-layout-view.server";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { artistPath } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import { AlphabetJumpBar } from "@auction/ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

const PAGE_SIZE = 24;

export type ArtistsDirectoryShellProps = {
  preset: ArtistDirectoryPreset;
  /** Resolved query record (already awaited). */
  searchParams: Record<string, string | string[] | undefined>;
};

/** Path-aware preset chip — preserves `q`, `sort` across slices. Nationality is
 * handled by canonical path-segment URLs so we don't carry it as a query param. */
function presetChips(
  currentId: ArtistDirectoryPresetId,
  sp: Record<string, string | string[] | undefined>,
  layoutView: CatalogLayoutView,
) {
  const carry: Record<string, string | null> = {
    q: firstString(sp.q) ?? null,
    sort: firstString(sp.sort) ?? null,
    view: layoutView,
  };
  return ARTIST_DIRECTORY_PRESETS.filter(
    (p) =>
      p.id === "all" ||
      p.id === "featured" ||
      p.id === "living" ||
      p.id === "historical" ||
      p.id === "kind-brands" ||
      p.id === "kind-makers",
  ).map((p) => ({
    id: p.id,
    label: p.label,
    href: artistDirectoryWithQuery(p.canonicalPath, {}, carry),
    active: p.id === currentId,
  }));
}

const SORT_OPTIONS = [
  { value: "name_asc", label: "A–Z" },
  { value: "popular", label: "Most lots" },
  { value: "recent", label: "Recently added" },
] as const;
type SortValue = (typeof SORT_OPTIONS)[number]["value"];

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
  const offset = parseArtistDirectoryOffset(sp);
  const q = firstString(sp.q)?.trim();
  // Path-segment nationality locks the slice; when locked, the query-param
  // `nationality` is ignored so the canonical URL stays the only source of truth.
  const nationalityFromQuery = firstString(sp.nationality)?.trim();
  const nationality = preset.filter.nationality ?? nationalityFromQuery ?? undefined;
  const nationalityIsLocked = Boolean(preset.filter.nationality);
  // Path-segment decade locks the slice; when locked, the query-param `decade`
  // is ignored so the canonical URL stays the only source of truth.
  const decadeFromQuery = firstString(sp.decade)?.trim();
  const decade = preset.filter.decade ?? decadeFromQuery ?? undefined;
  const decadeIsLocked = Boolean(preset.filter.decade);
  const hasUpcomingRaw = firstString(sp.hasUpcoming)?.trim();
  const hasUpcoming = hasUpcomingRaw === "true" || hasUpcomingRaw === "1";
  const sortRaw = firstString(sp.sort)?.trim();
  const sort: "name_asc" | "popular" | "recent" =
    sortRaw === "popular" || sortRaw === "recent" ? sortRaw : "name_asc";

  const session = await getServerSessionUser();
  const isAuthenticated = Boolean(session);
  const layoutView: CatalogLayoutView = await resolveMarketingLayoutView({
    routeKey: "artists",
    category: "artists",
    urlView: firstString(sp.view),
    user: session,
    fallback: "grid",
  });
  const watchedIds = isAuthenticated ? await getServerMyArtistWatchIds() : [];
  const watchSet = new Set(watchedIds);

  const browseParams = {
    limit: PAGE_SIZE,
    offset,
    sort,
    ...(q ? { q } : {}),
    ...(preset.filter.kinds && preset.filter.kinds.length > 0
      ? { kinds: preset.filter.kinds.join(",") }
      : {}),
    ...(preset.filter.living ? { living: true } : {}),
    ...(preset.filter.historical ? { historical: true } : {}),
    ...(preset.filter.featuredOnly ? { featuredOnly: true } : {}),
    ...(preset.filter.featuredFirst ? { featuredFirst: true } : {}),
    ...(preset.filter.letter ? { letter: preset.filter.letter } : {}),
    ...(nationality ? { nationality } : {}),
    ...(decade ? { decade } : {}),
    ...(hasUpcoming ? { hasUpcoming: true } : {}),
  };

  const { rows, total, facets } = await fetchPublicArtistBrowse(browseParams);

  // Carry params survive across slice navigation. We never carry `decade` or
  // `nationality` as query strings — when a user picks either we send them to
  // the canonical path-segment URL, so query-params are for back-compat only.
  const carry: Record<string, string | null> = {
    q: q ?? null,
    sort: sort === "name_asc" ? null : sort,
    hasUpcoming: hasUpcoming ? "true" : null,
    view: layoutView,
  };

  // Side rail: scenario / kind groups linking to canonical paths, preserving carry params.
  const filterGroups = [
    {
      id: "scenario",
      title: "Scenario",
      links: [
        {
          label: "All",
          href: artistDirectoryWithQuery("/artists", {}, carry),
          count: facets.total,
          active: preset.id === "all",
        },
        {
          label: "Featured",
          href: artistDirectoryWithQuery("/artists/featured", {}, carry),
          count: facets.featured,
          active: preset.id === "featured",
        },
        {
          label: "Living",
          href: artistDirectoryWithQuery("/artists/living", {}, carry),
          count: facets.living,
          active: preset.id === "living",
        },
        {
          label: "Historical",
          href: artistDirectoryWithQuery("/artists/historical", {}, carry),
          count: facets.historical,
          active: preset.id === "historical",
        },
      ],
    },
    {
      id: "kind",
      title: "Kind",
      links: [
        {
          label: "Artists",
          href: artistDirectoryWithQuery("/artists/kind/artists", {}, carry),
          count: facets.byKind.artist,
          active: preset.id === "kind-artists",
        },
        {
          label: "Makers & studios",
          href: artistDirectoryWithQuery("/artists/kind/makers", {}, carry),
          count: facets.byKind.maker,
          active: preset.id === "kind-makers",
        },
        {
          label: "Brands",
          href: artistDirectoryWithQuery("/artists/kind/brands", {}, carry),
          count: facets.byKind.brand,
          active: preset.id === "kind-brands",
        },
        {
          label: "Marques",
          href: artistDirectoryWithQuery("/artists/kind/marques", {}, carry),
          count: facets.byKind.marque,
          active: preset.id === "kind-marques",
        },
      ],
    },
    {
      id: "lots",
      title: "Lots",
      links: [
        {
          label: "Has upcoming lots",
          href: artistDirectoryWithQuery(preset.canonicalPath, sp, {
            hasUpcoming: hasUpcoming ? null : "true",
            offset: null,
            view: layoutView,
          }),
          count: facets.hasUpcoming,
          active: hasUpcoming,
        },
      ],
    },
    ...(facets.topDecades.length > 0 || decadeIsLocked
      ? [
          {
            id: "decade",
            title: "Born",
            links: [
              {
                label: "Any decade",
                // When decade is locked via path-segment, "Any decade" sends
                // the user back to the catch-all `/artists` slice — clearing
                // the lock without losing the other carry params.
                href: decadeIsLocked
                  ? artistDirectoryWithQuery("/artists", {}, carry)
                  : artistDirectoryWithQuery(preset.canonicalPath, sp, {
                      decade: null,
                      offset: null,
                      view: layoutView,
                    }),
                active: !decade,
              },
              ...facets.topDecades.map((d) => ({
                label: d.label,
                // Decade chips always navigate to the canonical decade slice
                // so the URL reflects the filter — better for SEO and sharing.
                href: artistDirectoryWithQuery(`/artists/decade/${d.key}`, {}, carry),
                count: d.count,
                active: decade === d.key,
              })),
            ],
          },
        ]
      : []),
  ];

  // Nationality links navigate to canonical path-segment URLs. "Any" sends
  // the user back to the current slice (or `/artists` if nationality-locked).
  const buildNationalityHref = (value: string | null) => {
    if (value === null) {
      // "Any nationality" — clear the filter
      return nationalityIsLocked
        ? artistDirectoryWithQuery("/artists", {}, carry)
        : artistDirectoryWithQuery(preset.canonicalPath, sp, {
            nationality: null,
            offset: null,
            view: layoutView,
          });
    }
    // Navigate to canonical nationality slice
    const slug = slugifyNationality(value);
    return artistDirectoryWithQuery(`/artists/nationality/${slug}`, {}, carry);
  };

  const segChips = presetChips(preset.id, sp, layoutView);

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

  // Query-param versions of decade/nationality are the only "user filter" forms —
  // a path-segment lock is part of the canonical slice and shouldn't trigger
  // the clear-link.
  const hasUserFilters =
    Boolean(q) ||
    Boolean(nationalityFromQuery) ||
    Boolean(decadeFromQuery) ||
    hasUpcoming ||
    Boolean(sortRaw && sortRaw !== "name_asc");

  // Letter facet bar: the API returns a single `#` bucket for digits + a separate `other` bucket.
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const getPageHref = (page: number) => {
    const nextOffset = (page - 1) * PAGE_SIZE;
    return artistDirectoryWithQuery(preset.canonicalPath, sp, {
      offset: nextOffset <= 0 ? null : nextOffset,
      view: layoutView,
    });
  };
  const prevHref =
    offset > 0
      ? artistDirectoryWithQuery(preset.canonicalPath, sp, {
          offset: offset - PAGE_SIZE <= 0 ? null : offset - PAGE_SIZE,
          view: layoutView,
        })
      : null;
  const nextHref =
    offset + rows.length < total
      ? artistDirectoryWithQuery(preset.canonicalPath, sp, {
          offset: offset + PAGE_SIZE,
          view: layoutView,
        })
      : null;

  const rangeStart = total > 0 ? Math.min(offset + 1, total) : 0;
  const rangeEnd = total > 0 ? Math.min(offset + rows.length, total) : 0;
  const countLabel =
    total > 0 ? `Showing ${rangeStart}–${rangeEnd} of ${total}` : "No artists match these filters.";

  return (
    <main id="main-content" className="pt-[var(--header-height)]">
      <script type="application/ld+json" suppressHydrationWarning>
        {jsonLdScript(crumbsLd)}
      </script>
      {rows.length > 0 ? (
        <script type="application/ld+json" suppressHydrationWarning>
          {jsonLdScript(itemsLd)}
        </script>
      ) : null}

      <ArtistsDirectoryHero
        preset={preset}
        layoutView={layoutView}
        sort={sort}
        {...(q ? { q } : {})}
        {...(nationalityFromQuery && !nationalityIsLocked ? { nationalityFromQuery } : {})}
        nationalityIsLocked={nationalityIsLocked}
        segChips={segChips}
        letterBar={letterBar}
      />

      <section className="mx-auto max-w-7xl px-6 py-12 md:px-12">
        <link rel="canonical" href={canonicalUrl} />

        <div className="grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)]">
          <MarketingFilterSidebar aria-label="Artist directory filters">
            <ArtistDirectoryFilters
              groups={filterGroups}
              nationalities={facets.topNationalities}
              buildNationalityHref={buildNationalityHref}
              activeNationality={nationality ?? null}
              clearHref={preset.canonicalPath}
              hasFilters={hasUserFilters}
            />
          </MarketingFilterSidebar>

          <div className="min-w-0">
            <MarketingListToolbar
              className="mb-6 -mx-4 rounded-none border-x-0 md:-mx-6"
              countLabel={countLabel}
              sort={
                <div
                  role="tablist"
                  aria-label="Sort artists"
                  className="flex flex-wrap items-center gap-2"
                >
                  <span
                    aria-hidden
                    className="mr-1 font-label text-[10px] uppercase tracking-widest text-on-surface-variant"
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
                        role="tab"
                        aria-selected={active}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "rounded-full px-3 py-1.5 font-label text-[10px] uppercase tracking-widest ring-1 transition-colors",
                          active
                            ? "bg-primary text-on-primary ring-primary"
                            : "bg-surface-container-low text-on-surface-variant ring-outline-variant/20 hover:bg-surface-container-high/80 hover:text-on-surface",
                        )}
                      >
                        {o.label}
                      </Link>
                    );
                  })}
                </div>
              }
              trailing={
                <>
                  <CopyCatalogLinkButton />
                  <CatalogViewSwitcher routeKey="artists" value={layoutView} />
                </>
              }
            />

            {rows.length === 0 ? (
              <MarketingEmptyState
                variant="panel"
                className="rounded-2xl border-dashed border-outline-variant/40 bg-surface-container-low/40"
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
              <CatalogArtistView
                view={layoutView}
                rows={rows}
                watchSet={watchSet}
                isAuthenticated={isAuthenticated}
              />
            )}

            {total > 0 ? (
              <ArtistsDirectoryPagination
                currentPage={currentPage}
                totalPages={totalPages}
                prevHref={prevHref}
                nextHref={nextHref}
                getPageHref={getPageHref}
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
    </main>
  );
}
