import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { z } from "zod";
import type { SavedSearchRow } from "./saved-searches.client";

const savedSearchSchema = z.object({
  id: z.string(),
  label: z.string(),
  query: z.record(z.string()),
  notifyEmail: z.boolean(),
  createdAt: z.string(),
}) satisfies z.ZodType<SavedSearchRow>;

/** The person's saved catalogue searches, newest first; `null` when they could not be read. */
export async function getServerMySavedSearches(): Promise<SavedSearchRow[] | null> {
  const res = await authedServerFetch("/users/me/saved-searches", { cache: "no-store" });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { data?: unknown } | null;
  const parsed = z.array(savedSearchSchema).safeParse(body?.data);
  return parsed.success ? parsed.data : null;
}
