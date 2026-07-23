import type { CatalogActiveFilterChip } from "@/lib/admin/catalog/types";
import { type SearchParams, omitParamsHref } from "@/lib/admin/filter-chips/shared";
import { deliveryModeShortLabel } from "@/lib/presenters/delivery-mode/delivery-mode-registry";
import type { SaleDeliveryMode } from "@auction/types";

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
    const mode = ctx.deliveryMode as SaleDeliveryMode;
    chips.push({
      id: "deliveryMode",
      label: `Delivery: ${deliveryModeShortLabel(mode)}`,
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
