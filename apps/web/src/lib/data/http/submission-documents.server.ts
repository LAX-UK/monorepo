import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
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
  const body = (await res.json().catch(() => null)) as { data?: EntityDocument[] } | null;
  return body?.data ?? [];
}
