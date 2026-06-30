import type { CatalogActiveFilterChip } from "@/components/admin/catalog/catalog-active-filters-row";
import { type SearchParams, omitParamsHref } from "@/lib/admin/filter-chips/shared";
import { isLotListSortKey } from "@/lib/admin/lots-list-sort";

const LOT_SORT_LABELS: Record<string, string> = {
  createdDesc: "Newest first",
  endingAsc: "Ending soon",
  hammerDesc: "Highest hammer",
  endedDesc: "Recently ended",
};

const LOT_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  active: "Live",
  ended: "Ended",
  cancelled: "Cancelled",
};

export function buildLotsActiveFilterChips(
  sp: SearchParams,
  ctx: {
    q?: string;
    artistId?: string;
    artistName?: string | null;
    saleId?: string;
    saleTitle?: string | null;
    categoryId?: string;
    categoryName?: string | null;
    sort?: string;
    status?: string;
    activeLens: string;
    lensOwnedSort?: boolean;
  },
): CatalogActiveFilterChip[] {
  const chips: CatalogActiveFilterChip[] = [];
  const base = "/admin/lots";

  if (ctx.q?.trim()) {
    chips.push({
      id: "q",
      label: `Search: ${ctx.q.trim()}`,
      clearHref: omitParamsHref(base, sp, ["q"]),
    });
  }
  if (ctx.artistId?.trim()) {
    chips.push({
      id: "artistId",
      label: ctx.artistName
        ? `Artist: ${ctx.artistName}`
        : `Artist ID ${ctx.artistId.slice(0, 8)}…`,
      clearHref: omitParamsHref(base, sp, ["artistId"]),
    });
  }
  if (ctx.saleId?.trim()) {
    chips.push({
      id: "saleId",
      label: ctx.saleTitle ? `Sale: ${ctx.saleTitle}` : `Sale ID ${ctx.saleId.slice(0, 8)}…`,
      clearHref: omitParamsHref(base, sp, ["saleId"]),
    });
  }
  if (ctx.categoryId?.trim()) {
    chips.push({
      id: "categoryId",
      label: ctx.categoryName
        ? `Category: ${ctx.categoryName}`
        : `Category ID ${ctx.categoryId.slice(0, 8)}…`,
      clearHref: omitParamsHref(base, sp, ["categoryId"]),
    });
  }
  if (ctx.sort && isLotListSortKey(ctx.sort) && !ctx.lensOwnedSort) {
    chips.push({
      id: "sort",
      label: `Sort: ${LOT_SORT_LABELS[ctx.sort] ?? ctx.sort}`,
      clearHref: omitParamsHref(base, sp, ["sort"]),
    });
  }
  if (ctx.status && ctx.activeLens === "all") {
    chips.push({
      id: "status",
      label: `Status: ${LOT_STATUS_LABELS[ctx.status] ?? ctx.status}`,
      clearHref: omitParamsHref(base, sp, ["status"]),
    });
  }

  return chips;
}
