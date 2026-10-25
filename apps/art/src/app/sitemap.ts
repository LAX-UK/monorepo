import { isArtIndexingAllowed, loadArtStorefrontBaseUrl } from "@/env.server";
import { artServices } from "@/lib/art-services.server";
import { ART_NOTICE_SLUGS } from "@/lib/legal/art-notice-publication";
import { loadArtNoticeVisibility } from "@/lib/legal/art-notice-publication.server";
import { composeArtSitemap } from "@/lib/seo/art-sitemap.composer";
import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isArtIndexingAllowed()) return [];
  const base = loadArtStorefrontBaseUrl();
  // Only published notices are listed; a draft privacy or cookie notice is not indexable.
  const unpublished = new Set(
    ART_NOTICE_SLUGS.filter((slug) => loadArtNoticeVisibility(slug) !== "published").map((slug) =>
      new URL(`/legal/${slug}`, base).toString(),
    ),
  );
  const entries = await composeArtSitemap(artServices, base);
  return entries.filter((entry) => !unpublished.has(entry.url));
}
