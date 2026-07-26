import "server-only";

import { getAdminLegalEntityById } from "@/lib/data/http/admin.server";
import { getServerSubmissionDocuments } from "@/lib/data/http/submission-documents.server";
import { getAdminSubmissionById } from "@/lib/data/http/submissions.server";
import { cache } from "react";

/** Cached submission detail data shared by the layout and tab routes. */
export const loadAdminSubmissionDetailContext = cache(async (submissionId: string) => {
  const submission = await getAdminSubmissionById(submissionId);
  if (!submission) return null;

  const submitterLegalEntityId = submission.legalEntityId ?? submission.sellerId ?? null;
  const [submitterEntity, staffDocuments] = await Promise.all([
    submitterLegalEntityId
      ? getAdminLegalEntityById(submitterLegalEntityId).catch(() => null)
      : Promise.resolve(null),
    getServerSubmissionDocuments(submissionId),
  ]);

  return {
    submission,
    submitterLegalEntityId,
    submitterDisplayName: submitterEntity?.displayName ?? null,
    staffDocuments,
    documentCount: staffDocuments.length,
  };
});
