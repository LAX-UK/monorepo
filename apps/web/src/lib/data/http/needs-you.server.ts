import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { X_LEGAL_ENTITY_ID_HEADER } from "@/lib/legal-entity/client-acting-context";
import { type NeedsYouCounts, parseNeedsYouCounts } from "@/lib/workspace/needs-you-counts";

/**
 * The acting organisation's Needs-you counts, by section. `null` when the reader is unavailable:
 * the menu then shows no counts rather than wrong ones.
 */
export async function getServerNeedsYouCounts(
  legalEntityId: string,
): Promise<NeedsYouCounts | null> {
  try {
    const res = await authedServerFetch("/legal-entities/needs-you", {
      headers: { [X_LEGAL_ENTITY_ID_HEADER]: legalEntityId },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return parseNeedsYouCounts(await res.json().catch(() => null));
  } catch {
    return null;
  }
}
