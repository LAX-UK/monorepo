import "server-only";

import { getPublicLotById } from "@/lib/data/http/public-catalogue.server";
import { withdrawnLotPageExists } from "@/lib/lot-page/load-withdrawn-lot.server";
import { staffPreviewLot } from "@/lib/marketing/staff-catalogue-preview.server";
import { notFound } from "next/navigation";

/*
 * The lot route's 404 check (see `detail-page-existence.ts` for why it runs in the layout). Kept
 * in its own module so the lot route's server render stays session-free (CO-7).
 */

/**
 * A lot page exists for a lot the public may see, and for a withdrawn lot, which keeps its page.
 * Both are read without the session; a lot only staff may see is checked with it afterwards.
 */
export async function requireLotPage(lotId: string): Promise<void> {
  // Throws on a failed read; null means 404 or withdrawn.
  if (await getPublicLotById(lotId)) return;
  if ((await withdrawnLotPageExists(lotId)) === "exists") return;
  if (await staffPreviewLot(lotId)) return;
  notFound();
}
