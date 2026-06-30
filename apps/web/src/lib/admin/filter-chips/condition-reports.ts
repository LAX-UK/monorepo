import type { CatalogActiveFilterChip } from "@/components/admin/catalog/catalog-active-filters-row";
import { type SearchParams, omitParamsHref } from "@/lib/admin/filter-chips/shared";

const CR_LENS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In progress",
  fulfilled: "Fulfilled",
  declined: "Declined",
};

export function buildConditionReportsActiveFilterChips(
  sp: SearchParams,
  ctx: { activeLens: string },
): CatalogActiveFilterChip[] {
  if (ctx.activeLens === "open") return [];
  return [
    {
      id: "lens",
      label: `Lens: ${CR_LENS_LABELS[ctx.activeLens] ?? ctx.activeLens.replaceAll("_", " ")}`,
      clearHref: omitParamsHref("/admin/condition-reports", sp, ["lens"]),
    },
  ];
}
