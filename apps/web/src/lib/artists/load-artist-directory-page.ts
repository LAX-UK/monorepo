import { firstString } from "@/lib/admin/admin-list-params";
import {
  type ArtistDirectoryCarryParams,
  type ArtistDirectoryFilterRailInput,
  artistDirectoryPresetChips,
  buildArtistDirectoryFilterGroups,
  buildArtistDirectoryNationalityLinks,
} from "@/lib/artists/directory-filter-rail";
import type { ArtistDirectoryPreset } from "@/lib/artists/directory-presets";
import { artistDirectoryWithQuery, parseArtistDirectoryOffset } from "@/lib/artists/directory-url";
import { getServerMyArtistWatchIds } from "@/lib/data/http/artist-watchlist.server";
import { fetchPublicArtistBrowse } from "@/lib/data/http/artist.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { resolveMarketingLayoutView } from "@/lib/preferences/resolve-marketing-layout-view.server";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import type { PublicArtistDirectoryResult } from "@auction/types";

const PAGE_SIZE = 24;

export type ArtistDirectoryPageParams = {
  offset: number;
  q?: string;
  nationalityFromQuery?: string;
  nationality?: string;
  nationalityIsLocked: boolean;
  decadeFromQuery?: string;
  decade?: string;
  decadeIsLocked: boolean;
  hasUpcoming: boolean;
  categorySlug?: string;
  sort: "name_asc" | "popular" | "recent";
  sortRaw?: string;
};

export type ArtistDirectoryPageContext = {
  params: ArtistDirectoryPageParams;
  layoutView: CatalogLayoutView;
  isAuthenticated: boolean;
  watchSet: Set<string>;
  browse: PublicArtistDirectoryResult;
  carry: ArtistDirectoryCarryParams;
  filterRailInput: ArtistDirectoryFilterRailInput;
  presetChips: ReturnType<typeof artistDirectoryPresetChips>;
  filterGroups: ReturnType<typeof buildArtistDirectoryFilterGroups>;
  nationalityLinks: ReturnType<typeof buildArtistDirectoryNationalityLinks>;
  hasUserFilters: boolean;
  activeFilterCount: number;
  pagination: {
    totalPages: number;
    currentPage: number;
    getPageHref: (page: number) => string;
    rangeStart: number;
    rangeEnd: number;
    countLabel: string;
    resultCountLabel: string;
  };
};

function parseArtistDirectoryPageParams(
  preset: ArtistDirectoryPreset,
  searchParams: Record<string, string | string[] | undefined>,
): ArtistDirectoryPageParams {
  const offset = parseArtistDirectoryOffset(searchParams);
  const q = firstString(searchParams.q)?.trim();
  const nationalityFromQuery = firstString(searchParams.nationality)?.trim();
  const nationality = preset.filter.nationality ?? nationalityFromQuery ?? undefined;
  const nationalityIsLocked = Boolean(preset.filter.nationality);
  const decadeFromQuery = firstString(searchParams.decade)?.trim();
  const decade = preset.filter.decade ?? decadeFromQuery ?? undefined;
  const decadeIsLocked = Boolean(preset.filter.decade);
  const hasUpcomingRaw = firstString(searchParams.hasUpcoming)?.trim();
  const hasUpcoming = hasUpcomingRaw === "true" || hasUpcomingRaw === "1";
  const categorySlug = firstString(searchParams.category)?.trim();
  const sortRaw = firstString(searchParams.sort)?.trim();
  const sort: "name_asc" | "popular" | "recent" =
    sortRaw === "popular" || sortRaw === "recent" ? sortRaw : "name_asc";

  return {
    offset,
    ...(q ? { q } : {}),
    ...(nationalityFromQuery && !nationalityIsLocked ? { nationalityFromQuery } : {}),
    ...(nationality ? { nationality } : {}),
    nationalityIsLocked,
    ...(decadeFromQuery && !decadeIsLocked ? { decadeFromQuery } : {}),
    ...(decade ? { decade } : {}),
    decadeIsLocked,
    hasUpcoming,
    ...(categorySlug ? { categorySlug } : {}),
    sort,
    ...(sortRaw ? { sortRaw } : {}),
  };
}

/** Server-side loader for artist directory pages (params, browse data, filter rail). */
export async function loadArtistDirectoryPage(
  preset: ArtistDirectoryPreset,
  searchParams: Record<string, string | string[] | undefined>,
): Promise<ArtistDirectoryPageContext> {
  const params = parseArtistDirectoryPageParams(preset, searchParams);
  const session = await getServerSessionUser();
  const isAuthenticated = Boolean(session);
  const layoutView: CatalogLayoutView = await resolveMarketingLayoutView({
    routeKey: "artists",
    category: "artists",
    urlView: firstString(searchParams.view),
    user: session,
    fallback: "grid",
  });
  const watchedIds = isAuthenticated ? await getServerMyArtistWatchIds() : [];
  const watchSet = new Set(watchedIds);

  const browseParams = {
    limit: PAGE_SIZE,
    offset: params.offset,
    sort: params.sort,
    ...(params.q ? { q: params.q } : {}),
    ...(preset.filter.kinds && preset.filter.kinds.length > 0
      ? { kinds: preset.filter.kinds.join(",") }
      : {}),
    ...(preset.filter.living ? { living: true } : {}),
    ...(preset.filter.historical ? { historical: true } : {}),
    ...(preset.filter.featuredOnly ? { featuredOnly: true } : {}),
    ...(preset.filter.featuredFirst ? { featuredFirst: true } : {}),
    ...(preset.filter.letter ? { letter: preset.filter.letter } : {}),
    ...(params.nationality ? { nationality: params.nationality } : {}),
    ...(params.decade ? { decade: params.decade } : {}),
    ...(params.categorySlug ? { categorySlug: params.categorySlug } : {}),
    ...(params.hasUpcoming ? { hasUpcoming: true } : {}),
  };

  const browse = await fetchPublicArtistBrowse(browseParams);
  const { rows, total, facets } = browse;

  const carry: ArtistDirectoryCarryParams = {
    q: params.q ?? null,
    sort: params.sort === "name_asc" ? null : params.sort,
    hasUpcoming: params.hasUpcoming ? "true" : null,
    category: params.categorySlug ?? null,
    view: layoutView,
  };

  const filterRailInput: ArtistDirectoryFilterRailInput = {
    preset,
    searchParams,
    layoutView,
    facets,
    carry,
    nationalityIsLocked: params.nationalityIsLocked,
    decadeIsLocked: params.decadeIsLocked,
    hasUpcoming: params.hasUpcoming,
    ...(params.nationality ? { nationality: params.nationality } : {}),
    ...(params.decade ? { decade: params.decade } : {}),
    ...(params.categorySlug ? { categorySlug: params.categorySlug } : {}),
  };

  const hasUserFilters =
    Boolean(params.q) ||
    Boolean(params.nationalityFromQuery) ||
    Boolean(params.decadeFromQuery) ||
    Boolean(params.categorySlug) ||
    params.hasUpcoming ||
    Boolean(params.sortRaw && params.sortRaw !== "name_asc");

  const activeFilterCount =
    (params.q ? 1 : 0) +
    (params.nationalityFromQuery && !params.nationalityIsLocked ? 1 : 0) +
    (params.decadeFromQuery && !params.decadeIsLocked ? 1 : 0) +
    (params.categorySlug ? 1 : 0) +
    (params.hasUpcoming ? 1 : 0) +
    (params.sort !== "name_asc" ? 1 : 0);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(params.offset / PAGE_SIZE) + 1;
  const getPageHref = (page: number) => {
    const nextOffset = (page - 1) * PAGE_SIZE;
    return artistDirectoryWithQuery(
      preset.canonicalPath,
      searchParams,
      {
        offset: nextOffset <= 0 ? null : nextOffset,
        view: layoutView,
      },
      { preserveOffset: true },
    );
  };
  const rangeStart = total > 0 ? Math.min(params.offset + 1, total) : 0;
  const rangeEnd = total > 0 ? Math.min(params.offset + rows.length, total) : 0;
  const countLabel =
    total > 0 ? `Showing ${rangeStart}–${rangeEnd} of ${total}` : "No artists match these filters.";
  const resultCountLabel =
    total > 0 ? `Show ${total} artist${total === 1 ? "" : "s"}` : "Show results";

  return {
    params,
    layoutView,
    isAuthenticated,
    watchSet,
    browse,
    carry,
    filterRailInput,
    presetChips: artistDirectoryPresetChips(preset.id, searchParams, layoutView),
    filterGroups: buildArtistDirectoryFilterGroups(filterRailInput),
    nationalityLinks: buildArtistDirectoryNationalityLinks(filterRailInput),
    hasUserFilters,
    activeFilterCount,
    pagination: {
      totalPages,
      currentPage,
      getPageHref,
      rangeStart,
      rangeEnd,
      countLabel,
      resultCountLabel,
    },
  };
}

export { PAGE_SIZE as ARTIST_DIRECTORY_PAGE_SIZE };
