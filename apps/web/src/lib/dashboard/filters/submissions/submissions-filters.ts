import type { SubmissionListFilterValues } from "@auction/validators";
import { buildActiveFilterDescriptors, hasActiveFilters } from "../filter-active";
import { buildFilterHref } from "../filter-params";
import type { ActiveFilterDescriptor, FilterParamsRecord, ListPageFilterConfig } from "../types";

export const SUBMISSIONS_BASE_PATH = "/dashboard/submissions";

export type SubmissionsFilters = {
  status: SubmissionListFilterValues["status"];
  q: string;
};

export const SUBMISSIONS_FILTER_DEFAULTS: Record<string, string | undefined> = {
  status: "all",
  q: undefined,
};

export const SUBMISSIONS_FILTER_CONFIG: ListPageFilterConfig = {
  basePath: SUBMISSIONS_BASE_PATH,
  defaults: SUBMISSIONS_FILTER_DEFAULTS,
  filters: [
    {
      kind: "search",
      param: "q",
      label: "Title contains",
      placeholder: "Search by title…",
    },
  ],
};

export function parseSubmissionsParams(raw: {
  status?: string;
  q?: string;
}): SubmissionsFilters {
  const statusValues = [
    "all",
    "draft",
    "submitted",
    "under_review",
    "approved",
    "rejected",
    "withdrawn",
    "converted",
  ] as const;
  const status =
    raw.status && (statusValues as readonly string[]).includes(raw.status)
      ? (raw.status as SubmissionListFilterValues["status"])
      : "all";
  return {
    status,
    q: (raw.q ?? "").trim().slice(0, 200),
  };
}

export function submissionsFiltersToParams(filters: SubmissionsFilters): FilterParamsRecord {
  return {
    ...(filters.status !== "all" ? { status: filters.status } : {}),
    ...(filters.q ? { q: filters.q } : {}),
  };
}

export function buildSubmissionsHref(
  current: SubmissionsFilters,
  patch: Partial<{ status: SubmissionListFilterValues["status"]; q: string | null }>,
): string {
  const next: SubmissionsFilters = {
    status: patch.status ?? current.status,
    q: patch.q === undefined ? current.q : (patch.q ?? "").trim().slice(0, 200),
  };
  return buildFilterHref(SUBMISSIONS_BASE_PATH, submissionsFiltersToParams(next), {
    omitDefaults: SUBMISSIONS_FILTER_DEFAULTS,
  });
}

export function hasSubmissionsActiveFilters(filters: SubmissionsFilters): boolean {
  return hasActiveFilters(submissionsFiltersToParams(filters), SUBMISSIONS_FILTER_DEFAULTS, [
    "status",
    "q",
  ]);
}

export function getSubmissionsActiveFilters(filters: SubmissionsFilters): ActiveFilterDescriptor[] {
  return buildActiveFilterDescriptors(
    {
      basePath: SUBMISSIONS_BASE_PATH,
      params: submissionsFiltersToParams(filters),
      defaults: SUBMISSIONS_FILTER_DEFAULTS,
      omitDefaults: SUBMISSIONS_FILTER_DEFAULTS,
    },
    [
      {
        param: "q",
        isActive: () => Boolean(filters.q.trim()),
        label: () => `Search: ${filters.q}`,
        clearPatch: () => ({ q: undefined }),
      },
    ],
  );
}
