import "server-only";

import { getAdminFailedJobs } from "@/lib/data/http/admin-failed-jobs.reader";
import type { FailedJobList } from "@auction/types";
import { groupFailedJobs } from "./failed-job-groups";
import { nounForIds } from "./failed-job-outcome";
import {
  FAILED_JOBS_PAGE_SIZE,
  type FailedJobsSearch,
  failedJobsHref,
  hasFailedJobsFilters,
  parseFailedJobsSearch,
} from "./failed-jobs-search";
import { pageSummary } from "./failed-jobs.vm";

export type FailedJobsPagination = {
  summary: string;
  prevHref: string | null;
  nextHref: string | null;
};

/** Data and composition boundary for `/admin/failed-jobs`. */
export async function loadAdminFailedJobsPage(sp: FailedJobsSearch) {
  const filters = parseFailedJobsSearch(sp);
  const filtered = hasFailedJobsFilters(filters);

  try {
    const list = await getAdminFailedJobs({
      view: filters.view,
      sort: filters.sort,
      limit: FAILED_JOBS_PAGE_SIZE,
      offset: filters.offset,
      ...(filters.q ? { q: filters.q } : {}),
      ...(filters.source ? { source: filters.source } : {}),
      ...(filters.queue ? { queue: filters.queue } : {}),
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {}),
    });
    const last = filters.offset + list.rows.length;
    const pagination: FailedJobsPagination | null =
      list.rows.length === 0
        ? null
        : {
            summary: pageSummary(filters.offset, list.rows.length, list.total, {
              groups: groupFailedJobs(list.rows).length,
              noun: nounForIds(list.rows.map((row) => row.id)),
            }),
            prevHref:
              filters.offset > 0
                ? failedJobsHref(sp, {
                    offset: Math.max(0, filters.offset - FAILED_JOBS_PAGE_SIZE) || null,
                  })
                : null,
            nextHref:
              last < list.total
                ? failedJobsHref(sp, { offset: filters.offset + FAILED_JOBS_PAGE_SIZE })
                : null,
          };
    return {
      filters,
      filtered,
      list: list as FailedJobList | null,
      pagination,
      loadError: null as string | null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return {
      filters,
      filtered,
      list: null as FailedJobList | null,
      pagination: null,
      loadError:
        message === "forbidden"
          ? "You do not have access to failed jobs."
          : "Failed jobs could not be loaded. Check your connection, then try again.",
    };
  }
}
