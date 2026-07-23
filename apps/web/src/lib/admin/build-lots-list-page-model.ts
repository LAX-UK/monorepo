import { countActiveCatalogFilters } from "@/lib/admin/catalog-list-filter-utils";
import { adminLotListPath } from "@/lib/admin/catalog-routes";
import { lotActiveLensId, lotLensItems } from "@/lib/admin/catalog/lots-lenses";
import type { CatalogSegmentItem } from "@/lib/admin/catalog/types";
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
  _nav: { withdrawalsPending: number },
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

  const q = query.q ?? "";
  const artistId = query.artistId ?? "";
  const saleId = query.saleId ?? "";
  const categoryId = query.categoryId ?? "";
  const effectiveSort = (query.sort as LotListSortKey | undefined) ?? sort;
  const effectiveStatus = query.status;
  const lensOwnedSort = activeLens === "ending" && !sp.sort;

  const advancedFilterCount = countActiveCatalogFilters([
    q.trim() !== "" ? q : null,
    artistId.trim() !== "" ? artistId : null,
    saleId.trim() !== "" ? saleId : null,
    categoryId.trim() !== "" ? categoryId : null,
    effectiveSort && !lensOwnedSort ? effectiveSort : null,
    effectiveStatus && activeLens === "all" ? effectiveStatus : null,
  ]);

  const lenses: CatalogSegmentItem[] = [...lotLensItems(sp)];

  const hasListFilters =
    q.trim() !== "" ||
    artistId.trim() !== "" ||
    saleId.trim() !== "" ||
    categoryId.trim() !== "" ||
    activeLens !== "all";

  const lotsEmptyDescription =
    activeLens === "attention"
      ? "No draft lots missing photos in this view."
      : "Try another lens or clear filters in More filters.";

  const columnSort = {
    current: effectiveSort,
    hrefs: {
      createdDesc: buildSortHref(adminLotListPath(), sp, "createdDesc", effectiveSort),
      endingAsc: buildSortHref(adminLotListPath(), sp, "endingAsc", effectiveSort),
      hammerDesc: buildSortHref(adminLotListPath(), sp, "hammerDesc", effectiveSort),
      endedDesc: buildSortHref(adminLotListPath(), sp, "endedDesc", effectiveSort),
    },
  } as const;

  const exportFilters = lotsListExportFilters(query, effectiveSort);

  return {
    query,
    activeLens,
    attentionLens,
    sort,
    effectiveSort,
    effectiveStatus,
    q,
    artistId,
    saleId,
    categoryId,
    advancedFilterCount,
    lenses,
    hasListFilters,
    lotsEmptyDescription,
    columnSort,
    buildPaginationHref: (patch: Record<string, string | number | undefined>) =>
      buildListHref(adminLotListPath(), sp, patch),
    exportFilters,
  };
}
