import "server-only";

import { loadSubmissionAssigneeContext } from "@/lib/admin/submissions/load-submission-assignee";
import { getAdminCategoryById, getAdminLegalEntityById } from "@/lib/data/http/admin.server";
import { getAdminSubmissionById } from "@/lib/data/http/submissions.server";
import { buildSubmissionReviewViewModel } from "@/lib/data/view-models/submission-review.vm";
import type { ItemSubmission } from "@auction/types";

export type LoadedSubmissionReview = {
  vm: ReturnType<typeof buildSubmissionReviewViewModel>;
  submission: ItemSubmission;
  submitterDisplayName: string | null;
  submitterUserId: string | null;
  assigneeImage: string | null;
};

export async function loadSubmissionReview(
  submissionId: string,
  currentUserId: string,
): Promise<LoadedSubmissionReview | null> {
  const submission = await getAdminSubmissionById(submissionId);
  if (!submission) return null;

  const entityId = submission.legalEntityId ?? submission.sellerId ?? null;
  const categoryId = submission.categoryIds?.[0] ?? submission.categoryId?.trim() ?? null;

  const [sellerEntity, category, assigneeContext] = await Promise.all([
    entityId ? getAdminLegalEntityById(entityId).catch(() => null) : Promise.resolve(null),
    categoryId ? getAdminCategoryById(categoryId).catch(() => null) : Promise.resolve(null),
    loadSubmissionAssigneeContext(submission.assignedToUserId, currentUserId),
  ]);

  return {
    vm: buildSubmissionReviewViewModel({
      submission,
      currentUserId,
      sellerPreview: sellerEntity?.displayName ?? "Unknown seller",
      categoryPreview:
        category?.name && submission.medium?.trim()
          ? `${category.name} · ${submission.medium.trim()}`
          : (category?.name ?? submission.medium?.trim() ?? null),
      categoryName: category?.name ?? null,
      assigneeDisplayName: assigneeContext.assigneeDisplayName,
    }),
    submission,
    submitterDisplayName: sellerEntity?.displayName ?? null,
    submitterUserId: sellerEntity?.createdByUserId ?? null,
    assigneeImage: assigneeContext.assigneeImage,
  };
}
