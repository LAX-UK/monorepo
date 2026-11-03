import "server-only";

import type { LaxArtReturnView } from "@/lib/admin/lots/lax-art-return";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { cache } from "react";

/** Whether a lot can go back to lax.art; null when it could not be read (the action stays hidden). */
export const getServerLaxArtReturn = cache(
  async (lotId: string): Promise<LaxArtReturnView | null> => {
    const res = await authedServerFetch(`/admin/lots/${encodeURIComponent(lotId)}/lax-art-return`, {
      method: "GET",
      skipActingLegalEntityHeader: true,
    }).catch(() => null);
    if (!res?.ok) return null;
    const body = (await res.json().catch(() => null)) as { data?: LaxArtReturnView } | null;
    return body?.data ?? null;
  },
);
