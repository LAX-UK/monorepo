import "server-only";

import {
  failedJobDetailSchema,
  failedJobListSchema,
} from "@/lib/data/http/admin-failed-jobs.schema";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readData, safeReadData } from "@/lib/data/http/envelope";
import type { FailedJobDetail, FailedJobList, FailedJobView } from "@auction/types";

/** Filters of the failed jobs list, as the API's `/admin/system/failed-jobs` takes them. */
export type AdminFailedJobsParams = {
  view: FailedJobView;
  sort?: "failed_desc" | "failed_asc";
  q?: string;
  queue?: string;
  /** Inclusive London days, `YYYY-MM-DD`. */
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export function failedJobsQueryString(params: AdminFailedJobsParams): string {
  const qs = new URLSearchParams();
  qs.set("view", params.view);
  qs.set("limit", String(params.limit ?? 50));
  qs.set("offset", String(params.offset ?? 0));
  if (params.sort && params.sort !== "failed_desc") qs.set("sort", params.sort);
  if (params.q) qs.set("q", params.q);
  if (params.queue) qs.set("queue", params.queue);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  return qs.toString();
}

/** A view of failed jobs with its counts; throws `forbidden` when the person may not look. */
export async function getAdminFailedJobs(params: AdminFailedJobsParams): Promise<FailedJobList> {
  const res = await authedServerFetch(`/admin/system/failed-jobs?${failedJobsQueryString(params)}`);
  return readData(res, failedJobListSchema, {
    context: "GET /admin/system/failed-jobs",
    notOkMessage: (status) => (status === 403 ? "forbidden" : `Failed jobs unavailable: ${status}`),
  });
}

/** One failed job, or null when there is no such job or the person may not see it. */
export async function getAdminFailedJob(id: string): Promise<FailedJobDetail | null> {
  const res = await authedServerFetch(`/admin/system/failed-jobs/${encodeURIComponent(id)}`);
  return safeReadData(res, failedJobDetailSchema, {
    context: "GET /admin/system/failed-jobs/:id",
    nullStatuses: [404],
    notOkMessage: (status) => (status === 403 ? "forbidden" : `Failed job unavailable: ${status}`),
  });
}
