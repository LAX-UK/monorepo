import "server-only";

import { getServerMyWatchlist } from "@/lib/data/http/dashboard.server";
import { cache } from "react";

/**
 * Lot IDs the current session has on the watchlist. Cached per request so
 * multiple home sections can read without duplicate API calls.
 */
export const getServerWatchedLotIdSet = cache(async (): Promise<ReadonlySet<string>> => {
  try {
    const rows = await getServerMyWatchlist();
    return new Set(rows.map((r) => r.lotId));
  } catch {
    return new Set<string>();
  }
});
