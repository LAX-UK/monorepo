import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { readDataEnvelope, readJsonBody } from "@/lib/data/http/envelope";
import { cache } from "react";
import { z } from "zod";

const watchlistIdsSchema = z.object({ lotIds: z.array(z.string()).optional() });

/**
 * Lot IDs the current session has on the watchlist. Cached per request so
 * multiple home sections can read without duplicate API calls.
 */
export const getServerWatchedLotIdSet = cache(async (): Promise<ReadonlySet<string>> => {
  try {
    const res = await authedServerFetch("/users/me/watchlist/ids");
    if (!res.ok) return new Set<string>();
    const body = await readJsonBody(res);
    const parsed = readDataEnvelope(body, watchlistIdsSchema, "GET /users/me/watchlist/ids");
    return new Set(parsed.lotIds ?? []);
  } catch {
    return new Set<string>();
  }
});
