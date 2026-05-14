import { ArtistDirectoryCard } from "@/components/sections/artists/artist-directory-card";
import { ArtistDirectoryFilters } from "@/components/sections/artists/artist-directory-filters";
import { firstString } from "@/lib/admin/admin-list-params";
import {
  ARTIST_DIRECTORY_PRESETS,
  type ArtistDirectoryPreset,
  type ArtistDirectoryPresetId,
  slugifyNationality,
} from "@/lib/artists/directory-presets";
import { getServerMyArtistWatchIds } from "@/lib/data/http/artist-watchlist.server";
import { fetchPublicArtistBrowse } from "@/lib/data/http/artist.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { artistPath } from "@/lib/seo/url";
import { getSiteUrl } from "@/lib/site-url";
import { AlphabetJumpBar, PaginationFooter, SectionCta } from "@auction/ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

const PAGE_SIZE = 24;

export type ArtistsDirectoryShellProps = {
  preset: ArtistDirectoryPreset;
  /** Resolved query record (already awaited). */
  searchParams: Record<string, string | string[] | undefined>;
};

function parseOffset(sp: Record<string, string | string[] | undefined>): number {
  const raw = firstString(sp.offset);
  const n = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Append/replace `?key=value` keeping the rest of the query intact. `null` removes. */
function withQuery(
  basePath: string,
  current: Record<string, string | string[] | undefined>,
  patch: Record<string, string | number | null | undefined>,
): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) {
    const s = firstString(v);
    if (s) out.set(k, s);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined || v === "") {
      out.delete(k);
      continue;
    }
    out.set(k, String(v));
  }
  out.delete("offset");
  const q = out.toString();
  return q ? `${basePath}?${q}` : basePath;
}

/** Path-aware preset chip — preserves `q`, `sort` across slices. Nationality is
 * handled by canonical path-segment URLs so we don't carry it as a query param. */
function presetChips(
  currentId: ArtistDirectoryPresetId,
  sp: Record<string, string | string[] | undefined>,
) {
  const carry: Record<string, string | null> = {
    q: firstString(sp.q) ?? null,
    sort: firstString(sp.sort) ?? null,
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
    href: withQuery(p.canonicalPath, {}, carry),
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
  const offset = parseOffset(sp);
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
  };

  // Side rail: scenario / kind groups linking to canonical paths, preserving carry params.
  const filterGroups = [
    {
      id: "scenario",
      title: "Scenario",
      links: [
        {
          label: "All",
          href: withQuery("/artists", {}, carry),
          count: facets.total,
          active: preset.id === "all",
        },
        {
          label: "Featured",
          href: withQuery("/artists/featured", {}, carry),
          count: facets.featured,
          active: preset.id === "featured",
        },
        {
          label: "Living",
          href: withQuery("/artists/living", {}, carry),
          count: facets.living,
          active: preset.id === "living",
        },
        {
          label: "Historical",
          href: withQuery("/artists/historical", {}, carry),
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
          href: withQuery("/artists/kind/artists", {}, carry),
          count: facets.byKind.artist,
          active: preset.id === "kind-artists",
        },
        {
          label: "Makers & studios",
          href: withQuery("/artists/kind/makers", {}, carry),
          count: facets.byKind.maker,
          active: preset.id === "kind-makers",
        },
        {
          label: "Brands",
          href: withQuery("/artists/kind/brands", {}, carry),
          count: facets.byKind.brand,
          active: preset.id === "kind-brands",
        },
        {
          label: "Marques",
          href: withQuery("/artists/kind/marques", {}, carry),
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
          href: withQuery(preset.canonicalPath, sp, {
            hasUpcoming: hasUpcoming ? null : "true",
            offset: null,
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
                  ? withQuery("/artists", {}, carry)
                  : withQuery(preset.canonicalPath, sp, { decade: null, offset: null }),
                active: !decade,
              },
              ...facets.topDecades.map((d) => ({
                label: d.label,
                // Decade chips always navigate to the canonical decade slice
                // so the URL reflects the filter — better for SEO and sharing.
                href: withQuery(`/artists/decade/${d.key}`, {}, carry),
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
        ? withQuery("/artists", {}, carry)
        : withQuery(preset.canonicalPath, sp, { nationality: null, offset: null });
    }
    // Navigate to canonical nationality slice
    const slug = slugifyNationality(value);
    return withQuery(`/artists/nationality/${slug}`, {}, carry);
  };

  const segChips = presetChips(preset.id, sp);

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

      <section className="border-b border-outline-variant/15 bg-surface-container-lowest/40 px-6 py-14 md:px-12">
        <div className="mx-auto max-w-7xl">
          <nav
            aria-label="Breadcrumb"
            className="mb-4 font-label text-[10px] uppercase tracking-[0.2em] text-secondary"
          >
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href="/" className="transition-colors hover:text-primary">
                  Home
                </Link>
              </li>
              <li aria-hidden className="text-outline-variant">
                /
              </li>
              {preset.id === "all" ? (
                <li className="text-on-surface" aria-current="page">
                  Artists
                </li>
              ) : (
                <>
                  <li>
                    <Link href="/artists" className="transition-colors hover:text-primary">
                      Artists
                    </Link>
                  </li>
                  <li aria-hidden className="text-outline-variant">
                    /
                  </li>
                  <li className="text-on-surface" aria-current="page">
                    {preset.heroTitle}
                  </li>
                </>
              )}
            </ol>
          </nav>

          <p className="font-label text-xs uppercase tracking-[0.2em] text-primary">Catalogue</p>
          <h1 className="mt-3 font-headline text-4xl tracking-tight text-on-surface md:text-5xl">
            {preset.heroTitle}
          </h1>
          <p className="mt-4 max-w-2xl font-body text-on-surface-variant">
            {preset.heroDescription}
          </p>

          <form
            method="get"
            action={preset.canonicalPath}
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            {sort !== "name_asc" ? <input type="hidden" name="sort" value={sort} /> : null}
            {nationalityFromQuery && !nationalityIsLocked ? (
              <input type="hidden" name="nationality" value={nationalityFromQuery} />
            ) : null}
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-label text-[10px] uppercase tracking-widest text-secondary">
                Search artists
              </span>
              <input
                type="search"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Name or keyword…"
                className="h-12 rounded-md border border-outline-variant bg-surface px-4 font-body text-on-surface shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
            <Button type="submit" className="h-12 shrink-0 px-8">
              Search
            </Button>
          </form>

          <div role="tablist" aria-label="Artist scenario" className="mt-6 flex flex-wrap gap-2">
            {segChips.map((c) => (
              <Link
                key={c.id}
                href={c.href}
                role="tab"
                aria-selected={c.active}
                className={cn(
                  "rounded-full px-4 py-2 font-label text-xs uppercase tracking-widest ring-1 transition-colors",
                  c.active
                    ? "bg-primary text-on-primary ring-primary"
                    : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80",
                )}
              >
                {c.label}
              </Link>
            ))}
          </div>

          <div className="mt-6">
            <p className="mb-2 font-label text-[10px] uppercase tracking-widest text-on-surface-variant">
              Jump to letter
            </p>
            {letterBar}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12 md:px-12">
        <link rel="canonical" href={canonicalUrl} />

        <div className="grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)]">
          <ArtistDirectoryFilters
            groups={filterGroups}
            nationalities={facets.topNationalities}
            buildNationalityHref={buildNationalityHref}
            activeNationality={nationality ?? null}
            clearHref={preset.canonicalPath}
            hasFilters={hasUserFilters}
          />

          <div className="min-w-0">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <p className="font-body text-sm text-on-surface-variant">
                {total > 0 ? (
                  <>
                    Showing {Math.min(offset + 1, total)}–{Math.min(offset + rows.length, total)} of{" "}
                    {total}
                  </>
                ) : (
                  "No artists match these filters."
                )}
              </p>
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
                  // `name_asc` is the implicit default — drop the param when picked,
                  // so the canonical URL stays clean for crawlers.
                  const href = withQuery(preset.canonicalPath, sp, {
                    sort: o.value === "name_asc" ? null : o.value,
                    offset: null,
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
            </div>

            {rows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container-low/40 p-10 text-center">
                <p className="font-headline text-lg text-on-surface">
                  No artists match these filters.
                </p>
                <p className="mt-2 font-body text-sm text-on-surface-variant">
                  Try a broader scenario or clear your filters.
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  <Button asChild>
                    <Link href={preset.canonicalPath}>Clear filters</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/artists">Browse all artists</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((a) => (
                  <ArtistDirectoryCard
                    key={a.id}
                    artist={a}
                    watching={watchSet.has(a.id)}
                    isAuthenticated={isAuthenticated}
                  />
                ))}
              </ul>
            )}

            {total > 0 ? (
              <div className="mt-10">
                <PaginationFooter
                  offset={offset}
                  limit={PAGE_SIZE}
                  total={total}
                  countOnPage={rows.length}
                  prevHref={
                    offset > 0
                      ? withQuery(preset.canonicalPath, sp, {
                          offset: Math.max(0, offset - PAGE_SIZE),
                        })
                      : null
                  }
                  nextHref={
                    offset + rows.length < total
                      ? withQuery(preset.canonicalPath, sp, { offset: offset + PAGE_SIZE })
                      : null
                  }
                />
              </div>
            ) : null}

            <div className="mt-16">
              <SectionCta
                title="Submit your portfolio"
                description="Request a valuation or submit work to be considered for an upcoming auction."
                primary={
                  <Button variant="cta" asChild>
                    <Link href="/dashboard/submissions/new">Submit work</Link>
                  </Button>
                }
                secondary={
                  <Button variant="outline" asChild>
                    <Link href="/sell">Selling guide</Link>
                  </Button>
                }
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
