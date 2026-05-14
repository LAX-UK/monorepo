import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import type { EntityDocument } from "@auction/types";

export async function getServerLotDocuments(lotId: string): Promise<EntityDocument[]> {
  const res = await authedServerFetch(`/lots/${encodeURIComponent(lotId)}/documents`, {
    method: "GET",
    skipActingLegalEntityHeader: true,
  });
  if (!res.ok) return [];
  const body = (await res.json().catch(() => null)) as { data?: EntityDocument[] } | null;
  return body?.data ?? [];
}
