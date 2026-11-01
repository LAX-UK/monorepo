import "server-only";

import { getAdminFailedJobs } from "@/lib/data/http/admin-failed-jobs.reader";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { FAILED_JOBS_WRITE_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type FailedJobList, type UserRole, userHasAccessTo } from "@auction/types";
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
  const user = await getServerSessionUser();
  const canAct = user
    ? userHasAccessTo(user.role as UserRole, user.staffRoles, FAILED_JOBS_WRITE_ACCESS)
    : false;

  try {
    const list = await getAdminFailedJobs({
      view: filters.view,
      sort: filters.sort,
      limit: FAILED_JOBS_PAGE_SIZE,
      offset: filters.offset,
      ...(filters.q ? { q: filters.q } : {}),
      ...(filters.queue ? { queue: filters.queue } : {}),
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {}),
    });
    const last = filters.offset + list.rows.length;
    const pagination: FailedJobsPagination | null =
      list.rows.length === 0
        ? null
        : {
            summary: pageSummary(filters.offset, list.rows.length, list.total),
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
      canAct,
      list: list as FailedJobList | null,
      pagination,
      loadError: null as string | null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return {
      filters,
      filtered,
      canAct,
      list: null as FailedJobList | null,
      pagination: null,
      loadError:
        message === "forbidden"
          ? "You do not have access to failed jobs."
          : "Failed jobs could not be loaded. Check your connection, then try again.",
    };
  }
}
