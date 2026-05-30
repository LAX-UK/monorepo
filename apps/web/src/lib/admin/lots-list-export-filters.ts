import type { LotStatus } from "@auction/types";
import type { LotsListQuery } from "./admin-list-controllers";
import type { LotListSortKey } from "./lots-list-sort";

export type LotsListExportFilters = {
  status?: LotStatus;
  q?: string;
  artistId?: string;
  saleId?: string;
  categoryId?: string;
  sort?: LotListSortKey;
  needsPhotos?: "1";
};

/** Export filters mirroring `lotsListController.fetch`. */
export function lotsListExportFilters(
  query: LotsListQuery,
  sort?: LotListSortKey,
): LotsListExportFilters {
  const filters: LotsListExportFilters = {};
  if (query.status !== undefined) filters.status = query.status;
  if (query.q !== undefined && query.q !== "") filters.q = query.q;
  if (query.artistId) filters.artistId = query.artistId;
  if (query.saleId) filters.saleId = query.saleId;
  if (query.categoryId) filters.categoryId = query.categoryId;
  const effectiveSort = sort ?? query.sort;
  if (effectiveSort) filters.sort = effectiveSort as LotListSortKey;
  if (query.needsPhotos) filters.needsPhotos = "1";
  return filters;
}
