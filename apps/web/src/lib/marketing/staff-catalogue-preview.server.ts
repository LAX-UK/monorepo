import "server-only";

import { isSessionLookupTransientError } from "@/lib/auth/session-lookup-error";
import { viewerCanSeeNonPublicCatalog } from "@/lib/catalog/public-catalog-visibility";
import { getServerDataContainer } from "@/lib/data/container.server";
import { getServerLotById } from "@/lib/data/http/lots.server";
import { getServerSaleLotsPage, getServerSaleShell } from "@/lib/data/http/sales.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import type { SaleroomReads } from "@/lib/marketing/saleroom-page-data.service";

/*
 * The one place the public sale and lot pages may read the session (CO-7).
 *
 * Those pages are rendered once for everyone from session-free reads, so they can be cached. A
 * sale or lot the public cannot see (draft, unpublished, test) answers 404 to those reads; only
 * then, and only to let staff preview it, is the session read here. That render is personal and
 * is never cached: reading the cookies makes it dynamic, and the public answer for the same
 * address stays a 404. A public sale or lot never reaches this module.
 */

async function staffMayPreview(): Promise<boolean> {
  const session = await getServerSessionUser().catch((error) => {
    if (isSessionLookupTransientError(error)) return null;
    throw error;
  });
  return viewerCanSeeNonPublicCatalog(session?.role, session?.staffRoles);
}

/** Session-carrying reads for a sale the public cannot see, or null when the viewer is not staff. */
export async function staffPreviewSaleReads(): Promise<SaleroomReads | null> {
  if (!(await staffMayPreview())) return null;
  return { shell: getServerSaleShell, lotsPage: getServerSaleLotsPage };
}

/** The lot as staff see it, or null when the viewer is not staff or the lot does not exist. */
export async function staffPreviewLot(lotId: string) {
  if (!(await staffMayPreview())) return null;
  return getServerLotById(lotId);
}

/**
 * The lot page's reads with the staff member's session, for a lot the public cannot see; null
 * when the viewer is not staff or the lot does not exist. The same reads the page used before it
 * became session-free.
 */
export async function staffPreviewLotPage(lotId: string) {
  if (!(await staffMayPreview())) return null;
  const container = await getServerDataContainer();
  const shell = await container.lotPage.loadShell(lotId);
  if (!shell) return null;
  return { shell, secondary: await container.lotPage.loadSecondary(shell) };
}
