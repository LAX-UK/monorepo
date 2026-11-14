import "server-only";

import { getPublicSaleShell } from "@/lib/data/http/public-catalogue.server";
import { staffPreviewSaleReads } from "@/lib/marketing/staff-catalogue-preview.server";
import { notFound } from "next/navigation";

/*
 * The sale route's 404 check (see `detail-page-existence.ts` for why it runs in the layout). Kept
 * in its own module so the sale route loads nothing of the lot route: the sale page's server
 * render must stay session-free (CO-7).
 */

/**
 * A sale page exists for a sale the public may see (a cancelled sale keeps its address), read
 * without the session so the check can be cached. A sale only staff may see is checked with the
 * session, and only after the public read said 404 (`staff-catalogue-preview.server`).
 */
export async function requireSalePage(saleId: string): Promise<void> {
  // Both reads return null only for a 404 and throw on any other failure.
  if (await getPublicSaleShell(saleId)) return;
  const preview = await staffPreviewSaleReads();
  if (!preview || !(await preview.shell(saleId))) notFound();
}
