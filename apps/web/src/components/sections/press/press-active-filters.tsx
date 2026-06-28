"use client";

import { CatalogActiveFilterChips } from "@/components/marketing/catalog-active-filter-chips";
import { type PressHubParams, buildPressActiveFilterChips } from "@/lib/marketing/press-params";

type Props = {
  params: PressHubParams;
  className?: string;
};

/** Removable active filter chips for the press hub. */
export function PressActiveFilters({ params, className }: Props) {
  const chips = buildPressActiveFilterChips(params);
  if (chips.length === 0) return null;

  return (
    <CatalogActiveFilterChips
      chips={chips}
      clearHref="/press"
      {...(className ? { className } : {})}
    />
  );
}
