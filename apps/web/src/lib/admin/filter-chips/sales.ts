import type { CatalogActiveFilterChip } from "@/components/admin/catalog/catalog-active-filters-row";
import { type SearchParams, omitParamsHref } from "@/lib/admin/filter-chips/shared";

export function buildSalesActiveFilterChips(
  sp: SearchParams,
  ctx: {
    q?: string;
    status?: string;
    deliveryMode?: string;
    lifecycle?: string;
    sort?: string;
    activeLensId?: string;
    lensOwnedLifecycle?: boolean;
    setupLens?: boolean;
  },
): CatalogActiveFilterChip[] {
  const chips: CatalogActiveFilterChip[] = [];
  const base = "/admin/sales";

  const SALE_STATUS_LABELS: Record<string, string> = {
    draft: "Draft",
    scheduled: "Scheduled",
    active: "Live",
    closed: "Closed",
    cancelled: "Cancelled",
  };

  const LIFECYCLE_LABELS: Record<string, string> = {
    upcoming: "Upcoming",
    live: "Live",
    closed: "Closed",
    settled: "Settled",
  };

  const DELIVERY_LABELS: Record<string, string> = {
    online: "Online",
    onsite: "On-site",
  };

  const SALE_SORT_LABELS: Record<string, string> = {
    createdDesc: "Newest first",
    startAsc: "Starting soonest",
  };

  if (ctx.q?.trim()) {
    chips.push({
      id: "q",
      label: `Search: ${ctx.q.trim()}`,
      clearHref: omitParamsHref(base, sp, ["q"]),
    });
  }
  if (ctx.setupLens) {
    chips.push({
      id: "lens",
      label: "Lens: Needs setup",
      clearHref: omitParamsHref(base, sp, ["lens", "needsSetup", "status"]),
    });
  } else if (ctx.lifecycle?.trim() && ctx.activeLensId === "all") {
    chips.push({
      id: "lifecycle",
      label: `Lifecycle: ${LIFECYCLE_LABELS[ctx.lifecycle] ?? ctx.lifecycle}`,
      clearHref: omitParamsHref(base, sp, ["lifecycle", "lens"]),
    });
  }
  if (ctx.status?.trim() && !ctx.setupLens) {
    chips.push({
      id: "status",
      label: `Status: ${SALE_STATUS_LABELS[ctx.status] ?? ctx.status}`,
      clearHref: omitParamsHref(base, sp, ["status"]),
    });
  }
  if (ctx.deliveryMode?.trim()) {
    chips.push({
      id: "deliveryMode",
      label: `Delivery: ${DELIVERY_LABELS[ctx.deliveryMode] ?? ctx.deliveryMode}`,
      clearHref: omitParamsHref(base, sp, ["delivery"]),
    });
  }
  if (ctx.sort && !ctx.lensOwnedLifecycle) {
    chips.push({
      id: "sort",
      label: `Sort: ${SALE_SORT_LABELS[ctx.sort] ?? ctx.sort}`,
      clearHref: omitParamsHref(base, sp, ["sort"]),
    });
  }

  return chips;
}
