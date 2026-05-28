import type { ListPageFilterConfig } from "./types";

/** Param keys declared in a list page filter config (for tests and future renderers). */
export function getFilterParamKeys(config: ListPageFilterConfig): string[] {
  return config.filters.map((filter) => filter.param);
}

/** Whether a filter definition is shown in the mobile sheet on small screens. */
export function isSheetPlacementFilter(filter: ListPageFilterConfig["filters"][number]): boolean {
  if (filter.kind === "chips" || filter.kind === "multi-select") {
    return filter.placement === "sheet";
  }
  return false;
}
