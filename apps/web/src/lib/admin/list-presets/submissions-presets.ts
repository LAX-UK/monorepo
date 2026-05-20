import type { SubmissionDecisionQueue } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";

const BASE = "/admin/submissions";

/** Canonical decision-queue URLs (replaces granular `status` chips on the admin list). */
export function submissionsDecisionQueueHref(
  queue: SubmissionDecisionQueue,
  current: Record<string, string | string[] | undefined>,
): string {
  return buildListHref(BASE, current, {
    queue,
    status: "",
    offset: 0,
  });
}
