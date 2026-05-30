import type { CatalogSegmentItem } from "@/components/admin/catalog/catalog-filter-bar";
import { adminSaleListPath } from "@/lib/admin/catalog-routes";
import type { SalePresetId } from "@/lib/admin/list-presets/sales-presets";
import { saleListActivePreset, saleListPresetHref } from "@/lib/admin/list-presets/sales-presets";
import { buildSortHref } from "@/lib/admin/list-sort";
import { isSaleListSortKey } from "@/lib/admin/sales-list-sort";
import { salesListController } from "./admin-list-controllers";
import { buildListHref } from "./admin-list-params";
import { salesListExportFilters } from "./sales-list-export-filters";

const PRESET_IDS: SalePresetId[] = ["all", "upcoming", "live", "closed", "settled"];
const PRESET_LABELS: Record<SalePresetId, string> = {
  all: "All",
  upcoming: "Upcoming",
  live: "Live",
  closed: "Closed",
  settled: "Settled",
};

export type SalesListSearchParams = {
  status?: string;
  lifecycle?: string;
  delivery?: string;
  q?: string;
  error?: string;
  limit?: string;
  offset?: string;
  period?: string;
  sort?: string;
};

export function buildSalesListPageModel(sp: SalesListSearchParams) {
  const sort = isSaleListSortKey(sp.sort) ? sp.sort : undefined;
  const query = salesListController.parseQuery({ ...sp, ...(sort ? { sort } : {}) });
  const q = query.q;
  const statusFilter = query.status;
  const lifecycleSlug = query.lifecycle ?? null;
  const deliveryFilter = query.delivery ?? null;
  const activeLensId = saleListActivePreset(sp);
  const hasListFilters = Boolean(statusFilter || q || lifecycleSlug != null || deliveryFilter);
  const activeFilterCount = [
    deliveryFilter ?? "",
    lifecycleSlug != null && activeLensId === "all" ? lifecycleSlug : "",
  ].filter((s) => String(s).trim() !== "").length;

  const salesEmptyDescription = (() => {
    if (!hasListFilters) return "Create a sale to group lots for a session or season.";
    if (q?.trim()) return "Try another search keyword or clear filters.";
    if (deliveryFilter && !lifecycleSlug && activeLensId === "all") {
      return "Try another delivery mode or clear filters.";
    }
    if (activeLensId !== "all" || lifecycleSlug) {
      return "Try another lifecycle lens or clear filters.";
    }
    return "Try adjusting filters or clear them to see more sales.";
  })();

  const lenses: CatalogSegmentItem[] = PRESET_IDS.map((id) => ({
    id,
    label: PRESET_LABELS[id],
    href: saleListPresetHref(id, sp),
  }));

  const columnSort = {
    current: sort,
    hrefs: {
      createdDesc: buildSortHref(adminSaleListPath(), sp, "createdDesc", sort),
      startAsc: buildSortHref(adminSaleListPath(), sp, "startAsc", sort),
    },
  } as const;

  const exportFilters = salesListExportFilters(query, sort);

  return {
    query,
    sort,
    q,
    statusFilter,
    lifecycleSlug,
    deliveryFilter,
    activeLensId,
    hasListFilters,
    activeFilterCount,
    salesEmptyDescription,
    lenses,
    columnSort,
    exportFilters,
    presetLabels: PRESET_LABELS,
    buildPaginationHref: (patch: Record<string, string | number | undefined>) =>
      buildListHref(adminSaleListPath(), sp, patch),
  };
}

export { PRESET_IDS, PRESET_LABELS };
