import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { parseSubmissionDocumentsList } from "@/lib/data/http/submissions.schema";
import type { EntityDocument } from "@auction/types";

export async function getServerSubmissionDocuments(
  submissionId: string,
): Promise<EntityDocument[]> {
  const res = await authedServerFetch(
    `/submissions/${encodeURIComponent(submissionId)}/documents`,
    {
      method: "GET",
      skipActingLegalEntityHeader: true,
    },
  );
  if (!res.ok) return [];
  const body = await res.json().catch(() => null);
  if (body == null) return [];
  try {
    return parseSubmissionDocumentsList(body) as EntityDocument[];
  } catch {
    return [];
  }
}
