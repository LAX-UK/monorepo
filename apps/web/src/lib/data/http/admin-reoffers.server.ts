import "server-only";

import type { LotReofferBundle } from "@/lib/admin/reoffer/reoffer-bundle";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import {
  type ReofferPreview,
  reofferPreviewSchema,
  staffBuyerDefaultSchema,
  staffReofferSchema,
} from "@auction/validators";
import { cache } from "react";
import { z } from "zod";

async function read<T>(path: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): Promise<T> {
  const res = await authedServerFetch(path);
  if (!res.ok) throw new Error(`Re-offer read ${path} failed: ${res.status}`);
  const body = (await res.json()) as { data?: unknown };
  return schema.parse(body.data);
}

/** Who the lot would be offered to next, read when a dialog opens; `null` if it cannot be read. */
export async function getLotReofferPreview(lotId: string): Promise<ReofferPreview | null> {
  try {
    return await read(
      `/admin/lots/${encodeURIComponent(lotId)}/reoffer-preview`,
      reofferPreviewSchema,
    );
  } catch (error) {
    console.error("[getLotReofferPreview] Failed to load the next bidder:", error);
    return null;
  }
}

/** One load per request, so the page header and the Overview tab share it. */
export const getLotReofferBundle = cache(async (lotId: string): Promise<LotReofferBundle> => {
  const base = `/admin/lots/${encodeURIComponent(lotId)}`;
  try {
    const [buyerDefault, offers, preview] = await Promise.all([
      read(`${base}/buyer-default`, staffBuyerDefaultSchema.nullable()),
      read(`${base}/reoffers`, z.array(staffReofferSchema)),
      read(`${base}/reoffer-preview`, reofferPreviewSchema),
    ]);
    return { status: "ready", buyerDefault, offers, preview };
  } catch (error) {
    console.error("[getLotReofferBundle] Failed to load the lot's re-offers:", error);
    return { status: "failed" };
  }
});
