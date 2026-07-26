import "server-only";

import { loadSubmissionReview } from "@/lib/admin/submissions/load-submission-review";
import type { LoadedSubmissionReview } from "@/lib/admin/submissions/load-submission-review";

export type SubmissionDecisionPageModel = LoadedSubmissionReview;

/** Data/composition boundary for `/admin/submissions/[id]/decision`. */
export async function loadAdminSubmissionDecisionPage(
  submissionId: string,
  currentUserId: string,
): Promise<SubmissionDecisionPageModel | null> {
  return loadSubmissionReview(submissionId, currentUserId);
}
