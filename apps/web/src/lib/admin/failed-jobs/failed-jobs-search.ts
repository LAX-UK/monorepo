import { buildListHref } from "@/lib/admin/admin-list-params";
import { dayRangeLabel } from "@/lib/admin/day-range-label";
import { accountingHref } from "@/lib/admin/finance/accounting-queue.vm";
import { searchChipLabel } from "@auction/staff-ui";
import {
  FAILED_JOB_ID_PREFIXES,
  FAILED_JOB_SOURCE_FAMILY_LABELS,
  type FailedJobSourceFamily,
  type FailedJobView,
  isAccountingQueueTab,
  isFailedJobSourceFamily,
  isFailedJobView,
} from "@auction/types";

export const FAILED_JOBS_PATH = "/admin/failed-jobs";
export const FAILED_JOBS_PAGE_SIZE = 50;

export type FailedJobsSearch = Record<string, string | string[] | undefined>;

export type FailedJobsSort = "failed_desc" | "failed_asc";
export const FAILED_JOBS_DEFAULT_SORT: FailedJobsSort = "failed_desc";

/** The failed jobs list's filters as the URL carries them. */
export type FailedJobsFilters = {
  view: FailedJobView;
  q: string;
  /** A kind of failure, or empty for all of them. */
  source: FailedJobSourceFamily | "";
  queue: string;
  from: string;
  to: string;
  sort: FailedJobsSort;
  offset: number;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function parseFailedJobsSearch(sp: FailedJobsSearch): FailedJobsFilters {
  const view = first(sp.view);
  const source = first(sp.source);
  const from = first(sp.from);
  const to = first(sp.to);
  const validFrom = DAY.test(from) ? from : "";
  const validTo = DAY.test(to) ? to : "";
  // A range typed the wrong way round is swapped rather than refused.
  const [lo, hi] =
    validFrom && validTo && validFrom > validTo ? [validTo, validFrom] : [validFrom, validTo];
  const offset = Number.parseInt(first(sp.offset), 10);
  return {
    view: isFailedJobView(view) ? view : "needs_review",
    q: first(sp.q).slice(0, 100),
    source: isFailedJobSourceFamily(source) ? source : "",
    queue: first(sp.queue).slice(0, 80),
    from: lo,
    to: hi,
    sort: first(sp.sort) === "failed_asc" ? "failed_asc" : FAILED_JOBS_DEFAULT_SORT,
    offset: Number.isFinite(offset) && offset > 0 ? Math.min(offset, 50_000) : 0,
  };
}

/**
 * Whether a search or filter narrows the list (the view tab and the Source do not: an empty
 * source says so itself, and offers to clear it).
 */
export function hasFailedJobsFilters(filters: FailedJobsFilters): boolean {
  return Boolean(filters.q || filters.queue || filters.from || filters.to);
}

/** The list URL with `patch` applied; any filter change returns to the first page. */
export function failedJobsHref(
  current: FailedJobsSearch,
  patch: Record<string, string | number | null | undefined>,
): string {
  const next = { ...patch };
  // The default view and order keep the URL clean.
  if (next.view === "needs_review") next.view = null;
  if (next.sort === FAILED_JOBS_DEFAULT_SORT) next.sort = null;
  return buildListHref(FAILED_JOBS_PATH, current, { offset: null, ...next });
}

/** A job id from a path segment: undone once if the router left it encoded; ids hold no `%`. */
export function decodeFailedJobId(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Where a row opens: its own page, or for a Zoho Books document (`accounting:<tab>:<id>`) the
 * Finance › Accounting tab it is in, where it is tried again under the same LAX reference.
 */
export function failedJobHref(id: string): string {
  if (id.startsWith(FAILED_JOB_ID_PREFIXES.accounting)) {
    const tab = id.slice(FAILED_JOB_ID_PREFIXES.accounting.length).split(":")[0] ?? "";
    return accountingHref({}, { tab: isAccountingQueueTab(tab) ? tab : null });
  }
  return `${FAILED_JOBS_PATH}/${encodeURIComponent(id)}`;
}

export type FailedJobsFilterChip = { id: string; label: string; clearHref: string };

/** One removable chip per filter that is on, worded as the filter reads in the toolbar. */
export function buildFailedJobsChips(
  filters: FailedJobsFilters,
  current: FailedJobsSearch,
  queueLabel: (id: string) => string,
): FailedJobsFilterChip[] {
  const chips: FailedJobsFilterChip[] = [];
  if (filters.q) {
    chips.push({
      id: "q",
      label: searchChipLabel(filters.q),
      clearHref: failedJobsHref(current, { q: null }),
    });
  }
  if (filters.source) {
    chips.push({
      id: "source",
      label: `Source: ${FAILED_JOB_SOURCE_FAMILY_LABELS[filters.source]}`,
      clearHref: failedJobsHref(current, { source: null }),
    });
  }
  if (filters.queue) {
    chips.push({
      id: "queue",
      label: `Type: ${queueLabel(filters.queue)}`,
      clearHref: failedJobsHref(current, { queue: null }),
    });
  }
  if (filters.from || filters.to) {
    chips.push({
      id: "date",
      label: `Last failed: ${dayRangeLabel(filters.from, filters.to)}`,
      clearHref: failedJobsHref(current, { from: null, to: null }),
    });
  }
  return chips;
}
