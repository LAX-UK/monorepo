import type { CatalogActiveFilterChip } from "@/lib/admin/catalog/types";
import { type SearchParams, omitParamsHref } from "@/lib/admin/filter-chips/shared";

export function buildCategoriesActiveFilterChips(
  sp: SearchParams,
  ctx: { q?: string },
): CatalogActiveFilterChip[] {
  if (!ctx.q?.trim()) return [];
  return [
    {
      id: "q",
      label: `Search: ${ctx.q.trim()}`,
      clearHref: omitParamsHref("/admin/categories", sp, ["q"]),
    },
  ];
}
