import { countActiveCatalogFilters } from "@/lib/admin/catalog-list-filter-utils";
import { adminSaleListPath } from "@/lib/admin/catalog-routes";
import { saleActiveLensId, saleLensItems } from "@/lib/admin/catalog/sales-lenses";
import type { SaleLensId } from "@/lib/admin/catalog/sales-lenses";
import type { CatalogSegmentItem } from "@/lib/admin/catalog/types";
import { buildSortHref } from "@/lib/admin/list-sort";
import { isSaleListSortKey } from "@/lib/admin/sales-list-sort";
import { salesListController } from "./admin-list-controllers";
import { buildListHref } from "./admin-list-params";
import { salesListExportFilters } from "./sales-list-export-filters";

const LENS_LABELS: Record<SaleLensId, string> = {
  all: "All",
  upcoming: "Upcoming",
  live: "Live",
  closed: "Closed",
  settled: "Settled",
  setup: "Needs setup",
};

export type SalesListSearchParams = {
  status?: string;
  lifecycle?: string;
  lens?: string;
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
  const activeLensId = saleActiveLensId(sp);
  const setupLens = activeLensId === "setup";

  const query = salesListController.parseQuery({
    ...sp,
    ...(sort ? { sort } : {}),
    ...(activeLensId === "upcoming" ? { lifecycle: "upcoming" } : {}),
    ...(activeLensId === "live" ? { lifecycle: "live" } : {}),
    ...(activeLensId === "closed" ? { lifecycle: "closed" } : {}),
    ...(activeLensId === "settled" ? { lifecycle: "settled" } : {}),
    ...(setupLens ? { status: "draft", lifecycle: "", lens: "setup", needsSetup: "1" } : {}),
  });

  const q = query.q;
  const statusFilter = query.status;
  const lifecycleSlug = query.lifecycle ?? null;
  const deliveryFilter = query.delivery ?? null;
  const hasListFilters = Boolean(
    statusFilter || q || lifecycleSlug != null || deliveryFilter || setupLens,
  );
  const lensOwnedLifecycle = activeLensId !== "all" && activeLensId !== "setup" && !sp.lifecycle;
  const activeFilterCount = countActiveCatalogFilters([
    q?.trim() ? q : null,
    sort && !lensOwnedLifecycle ? sort : null,
    deliveryFilter,
    lifecycleSlug != null && activeLensId === "all" ? lifecycleSlug : null,
  ]);

  const salesEmptyDescription = (() => {
    if (!hasListFilters) return "Create a sale to group lots for a session or season.";
    if (setupLens) return "All draft sales on this page are fully set up, or try clearing filters.";
    if (q?.trim()) return "Try another search keyword or clear filters.";
    if (deliveryFilter && !lifecycleSlug && activeLensId === "all") {
      return "Try another delivery mode or clear filters.";
    }
    if (activeLensId !== "all" || lifecycleSlug) {
      return "Try another lifecycle lens or clear filters.";
    }
    return "Try adjusting filters or clear them to see more sales.";
  })();

  const lenses: CatalogSegmentItem[] = [...saleLensItems(sp)];

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
    setupLens,
    hasListFilters,
    activeFilterCount,
    salesEmptyDescription,
    lenses,
    columnSort,
    exportFilters,
    presetLabels: LENS_LABELS,
    buildPaginationHref: (patch: Record<string, string | number | undefined>) =>
      buildListHref(adminSaleListPath(), sp, patch),
  };
}

export { LENS_LABELS as PRESET_LABELS };
