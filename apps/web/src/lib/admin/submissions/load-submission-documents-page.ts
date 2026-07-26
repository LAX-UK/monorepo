import "server-only";

import { loadAdminSubmissionDetailContext } from "@/lib/admin/submissions/load-submission-detail-context";
import type { EntityDocument } from "@auction/types";

export type SubmissionDocumentsPageModel = {
  submissionId: string;
  staffDocuments: EntityDocument[];
};

/** Data/composition boundary for `/admin/submissions/[id]/documents`. */
export async function loadAdminSubmissionDocumentsPage(
  submissionId: string,
): Promise<SubmissionDocumentsPageModel | null> {
  const context = await loadAdminSubmissionDetailContext(submissionId);
  if (!context) return null;

  return {
    submissionId,
    staffDocuments: context.staffDocuments,
  };
}
