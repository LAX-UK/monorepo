import type { CatalogActiveFilterChip } from "@/components/admin/catalog/catalog-active-filters-row";
import { type SearchParams, omitParamsHref } from "@/lib/admin/filter-chips/shared";

export function buildSubmissionsActiveFilterChips(
  sp: SearchParams,
  ctx: {
    q?: string;
    categoryId?: string;
    categoryName?: string | null;
    qualityGaps?: boolean;
    assignedToMe?: boolean;
    sort?: "sla";
  },
): CatalogActiveFilterChip[] {
  const chips: CatalogActiveFilterChip[] = [];
  const base = "/admin/submissions";

  if (ctx.q?.trim()) {
    chips.push({
      id: "q",
      label: `Search: ${ctx.q.trim()}`,
      clearHref: omitParamsHref(base, sp, ["q"]),
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
  if (ctx.assignedToMe) {
    chips.push({
      id: "assignedTo",
      label: "My queue",
      clearHref: omitParamsHref(base, sp, ["assignedTo"]),
    });
  }
  if (ctx.sort === "sla") {
    chips.push({
      id: "sort",
      label: "Sort: SLA (oldest first)",
      clearHref: omitParamsHref(base, sp, ["sort"]),
    });
  }
  if (ctx.qualityGaps) {
    chips.push({
      id: "qualityGaps",
      label: "Quality gaps only",
      clearHref: omitParamsHref(base, sp, ["qualityGaps"]),
    });
  }

  return chips;
}
