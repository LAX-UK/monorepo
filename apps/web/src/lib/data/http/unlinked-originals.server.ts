import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-fetch.server";
import { z } from "zod";

const unlinkedOriginalSchema = z.object({
  product: z.enum(["bid", "lax_art"]),
  id: z.string(),
  title: z.string(),
  artistName: z.string().nullable(),
  state: z.string(),
});

const unlinkedOriginalsViewSchema = z.object({
  blockPublishing: z.boolean(),
  counts: z.object({ bid: z.number().int(), laxArt: z.number().int() }),
  items: z.array(unlinkedOriginalSchema),
});

export type UnlinkedOriginal = z.infer<typeof unlinkedOriginalSchema>;
export type UnlinkedOriginalsView = z.infer<typeof unlinkedOriginalsViewSchema>;

/** The report and the switch; null when they could not be read, so the page says so. */
export async function getServerUnlinkedOriginals(): Promise<UnlinkedOriginalsView | null> {
  const res = await authedServerFetch("/admin/inventory/unlinked-originals", {
    method: "GET",
  }).catch(() => null);
  if (!res?.ok) return null;
  const body: unknown = await res.json().catch(() => null);
  if (!body || typeof body !== "object" || !("data" in body)) return null;
  const parsed = unlinkedOriginalsViewSchema.safeParse(body.data);
  return parsed.success ? parsed.data : null;
}
