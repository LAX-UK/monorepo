import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import type { EntityDocument } from "@auction/types";
import { cache } from "react";

export const getServerSaleDocuments = cache(async (saleId: string): Promise<EntityDocument[]> => {
  const res = await authedServerFetch(`/sales/${encodeURIComponent(saleId)}/documents`, {
    method: "GET",
    skipActingLegalEntityHeader: true,
  });
  if (!res.ok) return [];
  const body = (await res.json().catch(() => null)) as { data?: EntityDocument[] } | null;
  return body?.data ?? [];
});
