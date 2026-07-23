import type { CatalogActiveFilterChip } from "@/lib/admin/catalog/types";
import { type SearchParams, omitParamsHref } from "@/lib/admin/filter-chips/shared";

export const FULFILMENT_STATUS_LABELS: Record<string, string> = {
  awaiting_payment: "Awaiting payment",
  awaiting_release: "Awaiting release",
  released: "Released",
  ready_for_collection: "Ready for collection",
  in_transit: "In transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function buildFulfilmentActiveFilterChips(
  sp: SearchParams,
  ctx: { status?: string; q?: string },
): CatalogActiveFilterChip[] {
  const chips: CatalogActiveFilterChip[] = [];
  if (ctx.q?.trim()) {
    chips.push({
      id: "q",
      label: `Search: ${ctx.q.trim()}`,
      clearHref: omitParamsHref("/admin/lot-fulfilment", sp, ["q"]),
    });
  }
  if (ctx.status?.trim()) {
    chips.push({
      id: "status",
      label: `Status: ${FULFILMENT_STATUS_LABELS[ctx.status] ?? ctx.status.replaceAll("_", " ")}`,
      clearHref: omitParamsHref("/admin/lot-fulfilment", sp, ["status"]),
    });
  }
  return chips;
}
