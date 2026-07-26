import "server-only";

import { artistsListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import type { ArtistPresetId } from "@/lib/admin/artist-list-presets";
import { artistListActivePreset, artistListPresetHref } from "@/lib/admin/artist-list-presets";
import { buildArtistsActiveFilterChips } from "@/lib/admin/catalog-active-filter-chips";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { getAdminArtistStats } from "@/lib/data/http/admin.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { ARTIST_WRITE_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type CategoryNode, type UserRole, userHasAccessTo } from "@auction/types";

export type AdminArtistsListSearchParams = Record<string, string | string[] | undefined>;

const NAV_PRESETS = new Set<ArtistPresetId>(["all", "pending", "makers", "featured", "archived"]);

function flattenCategoryOptions(
  nodes: readonly CategoryNode[],
  depth = 0,
): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = [];
  for (const node of nodes) {
    out.push({ value: node.id, label: `${"\u2014 ".repeat(depth)}${node.name}` });
    if (node.children.length > 0) out.push(...flattenCategoryOptions(node.children, depth + 1));
  }
  return out;
}

export async function loadAdminArtistsListPage(sp: AdminArtistsListSearchParams) {
  const error = safeDecodeAdminErrorParam(sp.error);
  const showBackfill = sp.backfill === "1";
  const showDuplicates = sp.duplicates === "1";
  const skipIndexedList = showBackfill || showDuplicates;

  const user = await getServerSessionUser().catch(() => null);
  const canCreateArtist =
    user != null &&
    userHasAccessTo(user.role as UserRole, user.staffRole ?? null, ARTIST_WRITE_ACCESS);

  const query = artistsListController.parseQuery(sp);
  const q = query.q;

  const categoryOptions = await (async () => {
    if (skipIndexedList) return [];
    try {
      return flattenCategoryOptions(await (await getServerCategoryReader()).tree());
    } catch {
      return [];
    }
  })();

  let loadError: string | null = null;
  let artists: Awaited<ReturnType<typeof artistsListController.fetch>>["rows"] = [];
  let total = 0;
  let stats: Awaited<ReturnType<typeof getAdminArtistStats>> | null = null;
  let pendingReviewCount = 0;

  try {
    if (!skipIndexedList) {
      const [result, statsResult] = await Promise.all([
        artistsListController.fetch(query),
        getAdminArtistStats().catch(() => null),
      ]);
      artists = result.rows;
      total = result.total ?? 0;
      stats = statsResult;
      pendingReviewCount = statsResult?.pendingReview ?? 0;
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load artists.";
  }

  const preset = artistListActivePreset(sp);
  const activeLensId =
    showDuplicates === true
      ? "queues"
      : showBackfill === true
        ? "backfill"
        : NAV_PRESETS.has(preset)
          ? preset
          : "all";

  const queuesHref = buildListHref("/admin/artists", sp, {
    duplicates: "1",
    backfill: "",
    offset: 0,
  });

  const categoryName =
    query.categoryId && categoryOptions.length > 0
      ? (categoryOptions.find((o) => o.value === query.categoryId)?.label ?? null)
      : null;

  const activeFilterChips = skipIndexedList
    ? []
    : buildArtistsActiveFilterChips(sp, {
        ...(q ? { q } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.sort ? { sort: query.sort } : {}),
        ...(query.featured === true ? { featured: true } : {}),
        ...(query.verified === true ? { verified: true } : {}),
        ...(query.includeArchived === true ? { includeArchived: true } : {}),
        ...(query.archivedOnly === true ? { archivedOnly: true } : {}),
        ...(query.linked && query.linked !== "any" ? { linked: query.linked } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId, categoryName } : {}),
        ...(query.country ? { country: query.country } : {}),
      });

  const activeFilterCount = skipIndexedList
    ? 0
    : [
        q,
        query.status,
        query.kind,
        query.kinds,
        query.ownerUserId,
        query.categoryId,
        query.country,
        query.linked && query.linked !== "any" ? query.linked : "",
        query.archivedOnly ? "archivedOnly" : "",
        query.sort && query.sort !== "name_asc" ? query.sort : "",
        query.featured === true ? "featured" : "",
        query.verified === true ? "verified" : "",
        query.includeArchived === true ? "includeArchived" : "",
      ].filter(Boolean).length;

  const hasFilters = Boolean(
    showDuplicates ||
      showBackfill ||
      (!skipIndexedList &&
        (q ||
          query.includeArchived ||
          query.archivedOnly ||
          (query.kind && query.kind.trim() !== "") ||
          (query.kinds && query.kinds.trim() !== "") ||
          (query.status && query.status.trim() !== "") ||
          (query.ownerUserId && query.ownerUserId.trim() !== "") ||
          (query.categoryId && query.categoryId.trim() !== "") ||
          (query.country && query.country.trim() !== "") ||
          query.featured === true ||
          query.verified === true ||
          (query.linked && query.linked !== "any") ||
          (query.sort && query.sort.trim() !== "" && query.sort !== "name_asc"))),
  );

  const boardPagination =
    !skipIndexedList &&
    !loadError &&
    total > 0 &&
    (query.offset > 0 || query.offset + artists.length < total)
      ? {
          offset: query.offset,
          limit: query.limit,
          countOnPage: artists.length,
          prevHref:
            query.offset > 0
              ? buildListHref("/admin/artists", sp, {
                  offset: Math.max(0, query.offset - query.limit),
                })
              : null,
          nextHref:
            query.offset + artists.length < total
              ? buildListHref("/admin/artists", sp, { offset: query.offset + query.limit })
              : null,
        }
      : null;

  return {
    sp,
    error,
    showBackfill,
    showDuplicates,
    skipIndexedList,
    canCreateArtist,
    query,
    q,
    categoryOptions,
    loadError,
    artists,
    total,
    stats,
    pendingReviewCount,
    preset,
    activeLensId,
    queuesHref,
    activeFilterChips,
    activeFilterCount,
    hasFilters,
    boardPagination,
    artistListPresetHref: (id: ArtistPresetId) => artistListPresetHref(id, sp),
  };
}
