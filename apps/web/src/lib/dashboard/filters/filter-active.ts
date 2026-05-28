import { buildFilterHref, patchFilterParams } from "./filter-params";
import type { ActiveFilterDescriptor, FilterParamsRecord } from "./types";

export type ActiveFilterBuilderContext = {
  basePath: string;
  params: FilterParamsRecord;
  defaults: Record<string, string | undefined>;
  omitDefaults?: Record<string, string | undefined>;
};

/** Build dismissible active-filter pill descriptors from param state. */
export function buildActiveFilterDescriptors(
  ctx: ActiveFilterBuilderContext,
  descriptors: Array<{
    param: string;
    isActive: (params: FilterParamsRecord) => boolean;
    label: (params: FilterParamsRecord) => string;
    clearPatch: (params: FilterParamsRecord) => Partial<FilterParamsRecord>;
  }>,
): ActiveFilterDescriptor[] {
  const pills: ActiveFilterDescriptor[] = [];

  for (const desc of descriptors) {
    if (!desc.isActive(ctx.params)) continue;
    const nextParams = patchFilterParams(ctx.params, desc.clearPatch(ctx.params));
    pills.push({
      id: desc.param,
      label: desc.label(ctx.params),
      href: buildFilterHref(
        ctx.basePath,
        nextParams,
        ctx.omitDefaults ? { omitDefaults: ctx.omitDefaults } : undefined,
      ),
    });
  }

  return pills;
}

/** Whether any non-default filters are active. */
export function hasActiveFilters(
  params: FilterParamsRecord,
  defaults: Record<string, string | undefined>,
  keys: readonly string[],
): boolean {
  for (const key of keys) {
    const value = params[key];
    const defaultVal = defaults[key];
    if (Array.isArray(value)) {
      if (value.length > 0) return true;
      continue;
    }
    const str = typeof value === "string" ? value.trim() : "";
    if (!str) continue;
    if (defaultVal !== undefined && str === defaultVal) continue;
    return true;
  }
  return false;
}
