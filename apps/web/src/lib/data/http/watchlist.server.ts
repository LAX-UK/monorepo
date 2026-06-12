import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { cache } from "react";

/**
 * Lot IDs the current session has on the watchlist. Cached per request so
 * multiple home sections can read without duplicate API calls.
 */
export const getServerWatchedLotIdSet = cache(async (): Promise<ReadonlySet<string>> => {
  try {
    const res = await authedServerFetch("/users/me/watchlist/ids");
    if (!res.ok) return new Set<string>();
    const json = (await res.json()) as { data?: { lotIds?: string[] } };
    return new Set(json.data?.lotIds ?? []);
  } catch {
    return new Set<string>();
  }
});
