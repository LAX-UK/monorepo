import "server-only";

import { getAdminLegalEntityById } from "@/lib/data/http/admin.server";
import { getAdminSubmissionById } from "@/lib/data/http/submissions.server";
import type { ItemSubmission } from "@auction/types";

export type LoadedSubmissionReview = {
  submission: ItemSubmission;
  submitterDisplayName: string | null;
  submitterUserId: string | null;
};

/** What the decision tab needs: the submission and the seller behind it. */
export async function loadSubmissionReview(
  submissionId: string,
): Promise<LoadedSubmissionReview | null> {
  const submission = await getAdminSubmissionById(submissionId);
  if (!submission) return null;

  const entityId = submission.legalEntityId ?? submission.sellerId ?? null;
  const sellerEntity = entityId ? await getAdminLegalEntityById(entityId).catch(() => null) : null;

  return {
    submission,
    submitterDisplayName: sellerEntity?.displayName ?? null,
    submitterUserId: sellerEntity?.createdByUserId ?? null,
  };
}
