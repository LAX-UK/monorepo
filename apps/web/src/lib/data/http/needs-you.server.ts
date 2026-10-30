import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import type { NeedsYouCounts } from "@/lib/workspace/needs-you-counts";
import { type NeedsYouResponse, parseNeedsYouResponse } from "@/lib/workspace/needs-you-read";
import { cache } from "react";

/**
 * The acting organisation's Needs you, from the one reader. Read once per request: the sidebar
 * counts (the layout) and Home's list (the page) share the same answer, so they always agree.
 * `null` when the reader is unavailable: the menu then shows no counts rather than wrong ones,
 * and Home says it could not load the list.
 */
export const getServerNeedsYou = cache(
  async (legalEntityId: string): Promise<NeedsYouResponse | null> => {
    try {
      const res = await authedServerFetch("/legal-entities/needs-you", {
        headers: { [X_LEGAL_ENTITY_ID_HEADER]: legalEntityId },
        cache: "no-store",
      });
      if (!res.ok) return null;
      return parseNeedsYouResponse(await res.json().catch(() => null));
    } catch {
      return null;
    }
  },
);

/** The sidebar's counts, from the same read as Home. */
export async function getServerNeedsYouCounts(
  legalEntityId: string,
): Promise<NeedsYouCounts | null> {
  return (await getServerNeedsYou(legalEntityId))?.counts ?? null;
}
