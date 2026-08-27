import "server-only";

import {
  isPublicCatalogLot,
  viewerCanSeeNonPublicCatalog,
} from "@/lib/catalog/public-catalog-visibility";
import { getServerDataContainer } from "@/lib/data/container.server";
import { getServerLotById } from "@/lib/data/http/lots.server";
import { buildLotPageViewModel } from "@/lib/marketing/lot-page-vm";
import { lotPath, slugify } from "@/lib/seo/url";
import { appendMarketingParamsToPath } from "@auction/validators";
import { notFound, permanentRedirect } from "next/navigation";

export function ensureCanonicalLotSlug(
  slug: string,
  lot: { id: string; title: string },
  searchParams: Record<string, string | string[] | undefined> = {},
) {
  if (slug !== slugify(lot.title)) {
    permanentRedirect(appendMarketingParamsToPath(lotPath(lot), searchParams));
  }
}

export async function loadLotDetailPage(input: {
  id: string;
  slug: string;
  searchParams: Record<string, string | string[] | undefined>;
  serverNow: number;
}) {
  const container = await getServerDataContainer();
  const shell = await container.lotPage.loadShell(input.id);
  if (!shell) notFound();
  ensureCanonicalLotSlug(input.slug, shell.auction, input.searchParams);

  const canPreviewCatalog = viewerCanSeeNonPublicCatalog(
    shell.session?.role,
    shell.session?.staffRole,
  );
  if (!canPreviewCatalog && !isPublicCatalogLot(shell.auction, shell.saleBundle?.sale ?? null)) {
    notFound();
  }

  const secondary = await container.lotPage.loadSecondary(shell);
  return buildLotPageViewModel({
    shell,
    secondary,
    searchParams: input.searchParams,
    serverNow: input.serverNow,
  });
}

export async function loadLotDetailMetadata(id: string) {
  return getServerLotById(id);
}
