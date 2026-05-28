import type { FilterParamsRecord } from "./types";

export type BuildHrefOptions = {
  /** Params to omit from the built query string (e.g. defaults). */
  omitDefaults?: Record<string, string | undefined>;
};

/** Serialize filter params to a query string (no leading `?`). */
export function serializeFilterParams(
  params: FilterParamsRecord,
  options?: BuildHrefOptions,
): string {
  const qs = new URLSearchParams();
  const omit = options?.omitDefaults ?? {};

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      const omitVal = omit[key];
      if (omitVal === "" && value.length === 0) continue;
      qs.set(key, value.join(","));
      continue;
    }
    const trimmed = value.trim();
    if (!trimmed) continue;
    const omitVal = omit[key];
    if (omitVal !== undefined && omitVal === trimmed) continue;
    qs.set(key, trimmed);
  }

  return qs.toString();
}

/** Build a path + optional query for filter navigation. */
export function buildFilterHref(
  basePath: string,
  params: FilterParamsRecord,
  options?: BuildHrefOptions,
): string {
  const query = serializeFilterParams(params, options);
  return query ? `${basePath}?${query}` : basePath;
}

/** Patch current params immutably. */
export function patchFilterParams(
  current: FilterParamsRecord,
  patch: Partial<FilterParamsRecord>,
): FilterParamsRecord {
  const next: FilterParamsRecord = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === null || value === "") {
      delete next[key];
    } else {
      next[key] = value;
    }
  }
  return next;
}

/** Parse comma-separated IDs from a URL param. */
export function parseCommaSeparatedIds(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Toggle an ID in a comma-separated list param. */
export function toggleCommaSeparatedId(current: readonly string[], id: string): string[] {
  return current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
}

/** Count non-default active filter dimensions. */
export function countActiveFilterDimensions(
  params: FilterParamsRecord,
  defaults: Record<string, string | undefined>,
  keys: readonly string[],
): number {
  let count = 0;
  for (const key of keys) {
    const value = params[key];
    const defaultVal = defaults[key];
    if (Array.isArray(value)) {
      if (value.length > 0) count += 1;
      continue;
    }
    const str = typeof value === "string" ? value.trim() : "";
    if (!str) continue;
    if (defaultVal !== undefined && str === defaultVal) continue;
    count += 1;
  }
  return count;
}
