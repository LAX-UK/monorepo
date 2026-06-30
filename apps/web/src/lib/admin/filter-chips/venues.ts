import type { CatalogActiveFilterChip } from "@/components/admin/catalog/catalog-active-filters-row";
import { type SearchParams, omitParamsHref } from "@/lib/admin/filter-chips/shared";

export function buildVenuesActiveFilterChips(
  sp: SearchParams,
  ctx: {
    q?: string;
    includeArchived?: boolean;
    legalEntityId?: string;
    legalEntityName?: string | null;
  },
): CatalogActiveFilterChip[] {
  const chips: CatalogActiveFilterChip[] = [];
  if (ctx.q?.trim()) {
    chips.push({
      id: "q",
      label: `Search: ${ctx.q.trim()}`,
      clearHref: omitParamsHref("/admin/venues", sp, ["q"]),
    });
  }
  if (ctx.legalEntityId?.trim()) {
    chips.push({
      id: "legalEntityId",
      label: ctx.legalEntityName
        ? `Org: ${ctx.legalEntityName}`
        : `Org ID ${ctx.legalEntityId.slice(0, 8)}…`,
      clearHref: omitParamsHref("/admin/venues", sp, ["legalEntityId"]),
    });
  }
  if (ctx.includeArchived) {
    chips.push({
      id: "includeArchived",
      label: "Include archived",
      clearHref: omitParamsHref("/admin/venues", sp, ["includeArchived"]),
    });
  }
  return chips;
}
