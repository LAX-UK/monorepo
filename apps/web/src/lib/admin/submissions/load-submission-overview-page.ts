import "server-only";

import { loadSubmissionAssigneeContext } from "@/lib/admin/submissions/load-submission-assignee";
import { loadAdminSubmissionDetailContext } from "@/lib/admin/submissions/load-submission-detail-context";
import {
  EMPTY_ADMIN_SUBMISSIONS_LIST_SUMMARY,
  getAdminSubmissionsListSummary,
} from "@/lib/data/http/admin-submissions-summary.server";
import {
  getAdminCategoryList,
  getAdminDomainEventsForAggregate,
} from "@/lib/data/http/admin.server";
import type { AdminCategory, ItemSubmission } from "@auction/types";

export type SubmissionOverviewPageModel = {
  submission: ItemSubmission;
  documentCount: number;
  submitterDisplayName: string | null;
  assigneeDisplayName: string | null;
  avgQueueAgeDays: number | null;
  categories: Array<{ id: string; name: string }>;
  activityEvents: Awaited<ReturnType<typeof getAdminDomainEventsForAggregate>>;
};

function resolveSubmissionCategories(submission: ItemSubmission, allCategories: AdminCategory[]) {
  const ids =
    submission.categoryIds && submission.categoryIds.length > 0
      ? submission.categoryIds
      : submission.categoryId
        ? [submission.categoryId]
        : [];
  const byId = new Map(allCategories.map((c) => [c.id, c.name]));
  return ids.map((id) => ({ id, name: byId.get(id) ?? id }));
}

/** Data/composition boundary for `/admin/submissions/[id]` overview tab. */
export async function loadAdminSubmissionOverviewPage(
  submissionId: string,
  currentUserId: string,
): Promise<SubmissionOverviewPageModel | null> {
  const context = await loadAdminSubmissionDetailContext(submissionId);
  if (!context) return null;

  const { submission, documentCount, submitterDisplayName } = context;
  const categoryIds =
    submission.categoryIds && submission.categoryIds.length > 0
      ? submission.categoryIds
      : submission.categoryId
        ? [submission.categoryId]
        : [];

  const [allCategories, activityEvents, assigneeContext, submissionsSummary] = await Promise.all([
    categoryIds.length > 0
      ? getAdminCategoryList({ includeArchived: true }).catch(() => [])
      : Promise.resolve([]),
    getAdminDomainEventsForAggregate({
      aggregateType: "submission",
      aggregateId: submissionId,
      limit: 100,
    }).catch(() => []),
    loadSubmissionAssigneeContext(submission.assignedToUserId, currentUserId),
    getAdminSubmissionsListSummary().catch(() => EMPTY_ADMIN_SUBMISSIONS_LIST_SUMMARY),
  ]);

  return {
    submission,
    documentCount,
    submitterDisplayName,
    assigneeDisplayName: assigneeContext.assigneeDisplayName,
    avgQueueAgeDays: submissionsSummary.avgQueueAgeDays,
    categories: resolveSubmissionCategories(submission, allCategories),
    activityEvents,
  };
}
