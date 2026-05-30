import type { CatalogSegmentItem } from "@/components/admin/catalog/catalog-filter-bar";
import { adminLotListPath } from "@/lib/admin/catalog-routes";
import { lotActiveLensId, lotLensItems } from "@/lib/admin/catalog/lots-lenses";
import { buildSortHref } from "@/lib/admin/list-sort";
import { type LotListSortKey, isLotListSortKey } from "@/lib/admin/lots-list-sort";
import { lotsListController } from "./admin-list-controllers";
import { buildListHref } from "./admin-list-params";
import { lotsListExportFilters } from "./lots-list-export-filters";

export type LotsListSearchParams = {
  status?: string;
  error?: string;
  view?: string;
  q?: string;
  artistId?: string;
  saleId?: string;
  categoryId?: string;
  sort?: string;
  limit?: string;
  offset?: string;
  period?: string;
  lens?: string;
  needsPhotos?: string;
};

export function buildLotsListPageModel(
  sp: LotsListSearchParams,
  nav: { withdrawalsPending: number },
) {
  const activeLens = lotActiveLensId(sp);
  const attentionLens = activeLens === "attention";
  const sort = isLotListSortKey(sp.sort) ? sp.sort : undefined;

  const query = lotsListController.parseQuery({
    ...sp,
    ...(sort ? { sort } : {}),
    ...(activeLens === "live" ? { status: "active" } : {}),
    ...(activeLens === "draft" ? { status: "draft" } : {}),
    ...(activeLens === "ending" ? { status: "active", sort: "endingAsc" } : {}),
    ...(attentionLens ? { status: "draft", needsPhotos: "1" } : {}),
  });

  const viewPipeline = query.viewPipeline ?? false;
  const q = query.q ?? "";
  const artistId = query.artistId ?? "";
  const saleId = query.saleId ?? "";
  const categoryId = query.categoryId ?? "";
  const effectiveSort = (query.sort as LotListSortKey | undefined) ?? sort;
  const effectiveStatus = query.status;
  const lensOwnedSort = activeLens === "ending" && !sp.sort;

  const advancedFilterCount = [
    q,
    artistId,
    saleId,
    categoryId,
    viewPipeline,
    effectiveSort && !lensOwnedSort ? effectiveSort : null,
    effectiveStatus && activeLens === "all" ? effectiveStatus : null,
  ].filter(Boolean).length;

  const lenses: CatalogSegmentItem[] = [
    ...lotLensItems(
      sp,
      nav.withdrawalsPending > 0 ? { attention: nav.withdrawalsPending } : undefined,
    ),
  ];

  const columnSort = {
    current: effectiveSort,
    hrefs: {
      createdDesc: buildSortHref(adminLotListPath(), sp, "createdDesc", effectiveSort),
      endingAsc: buildSortHref(adminLotListPath(), sp, "endingAsc", effectiveSort),
      hammerDesc: buildSortHref(adminLotListPath(), sp, "hammerDesc", effectiveSort),
      endedDesc: buildSortHref(adminLotListPath(), sp, "endedDesc", effectiveSort),
    },
  } as const;

  const listParamsForToggle = Object.fromEntries(
    Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]),
  ) as Record<string, string | undefined>;

  const exportFilters = lotsListExportFilters(query, effectiveSort);

  return {
    query,
    activeLens,
    attentionLens,
    sort,
    effectiveSort,
    effectiveStatus,
    viewPipeline,
    q,
    artistId,
    saleId,
    categoryId,
    advancedFilterCount,
    lenses,
    columnSort,
    listParamsForToggle,
    buildPaginationHref: (patch: Record<string, string | number | undefined>) =>
      buildListHref(adminLotListPath(), sp, patch),
    exportFilters,
  };
}
