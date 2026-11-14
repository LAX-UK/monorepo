import "server-only";

import { isPublicCatalogLot } from "@/lib/catalog/public-catalog-visibility";
import { getPublicLotById } from "@/lib/data/http/public-catalogue.server";
import { ensureCanonicalLotSlug } from "@/lib/marketing/lot-canonical-slug";
import { buildLotPageViewModel } from "@/lib/marketing/lot-page-vm";
import { loadPublicLotSecondary, loadPublicLotShell } from "@/lib/marketing/public-lot-page-data";
import { staffPreviewLotPage } from "@/lib/marketing/staff-catalogue-preview.server";
import { notFound } from "next/navigation";

export { ensureCanonicalLotSlug } from "@/lib/marketing/lot-canonical-slug";

/**
 * The lot page as everyone sees it (CO-7): built from session-free, tagged reads with the
 * signed-out viewer. What is personal comes from `/api/lots/:id/me` in the browser, and the live
 * bid state from the socket. A lot the public cannot see falls back to the staff preview, the only
 * path that reads the session, and only after the public read found nothing.
 */
export async function loadLotDetailPage(input: {
  id: string;
  slug: string;
  searchParams: Record<string, string | string[] | undefined>;
  serverNow: number;
}) {
  const shell = await loadPublicLotShell(input.id);
  if (!shell || !isPublicCatalogLot(shell.auction, shell.saleBundle?.sale ?? null)) {
    const preview = await staffPreviewLotPage(input.id);
    if (!preview) notFound();
    ensureCanonicalLotSlug(input.slug, preview.shell.auction, input.searchParams);
    return buildLotPageViewModel({
      ...preview,
      searchParams: input.searchParams,
      serverNow: input.serverNow,
    });
  }
  ensureCanonicalLotSlug(input.slug, shell.auction, input.searchParams);

  const secondary = await loadPublicLotSecondary(shell);
  return buildLotPageViewModel({
    shell,
    secondary,
    searchParams: input.searchParams,
    serverNow: input.serverNow,
  });
}

/** The public lot for the page's metadata; a lot only staff may see has none (noindex anyway). */
export async function loadLotDetailMetadata(id: string) {
  return getPublicLotById(id);
}
