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

/**
 * Why the report could not be shown: LAX Bid did not answer (the request failed, or a gateway in
 * front of it gave up), or it answered with an error.
 */
export type UnlinkedOriginalsLoadFailure = "unreachable" | "server_error";

export type UnlinkedOriginalsLoad =
  | { ok: true; view: UnlinkedOriginalsView }
  | { ok: false; reason: UnlinkedOriginalsLoadFailure };

/** Statuses a gateway gives when LAX Bid itself did not answer in time. */
const GATEWAY_NO_ANSWER = new Set([502, 503, 504]);

/** The report and the switch, or why they could not be read, so the page says which. */
export async function getServerUnlinkedOriginals(): Promise<UnlinkedOriginalsLoad> {
  const res = await authedServerFetch("/admin/inventory/unlinked-originals", {
    method: "GET",
  }).catch(() => null);
  if (!res || GATEWAY_NO_ANSWER.has(res.status)) return { ok: false, reason: "unreachable" };
  if (!res.ok) return { ok: false, reason: "server_error" };
  const body: unknown = await res.json().catch(() => null);
  if (!body || typeof body !== "object" || !("data" in body)) {
    return { ok: false, reason: "server_error" };
  }
  const parsed = unlinkedOriginalsViewSchema.safeParse(body.data);
  return parsed.success ? { ok: true, view: parsed.data } : { ok: false, reason: "server_error" };
}
